// The user's proposed setup, tested exactly as specified:
//
//   1) wait for a 4H FVG to form
//   2) wait for price to enter that 4H FVG (observed on 5m)
//   3) wait for a NEW FVG to form on 5m, inside/after that entry
//   4) enter on the 5m FVG
//   5) target 3R
//
// This is a classic HTF-point-of-interest + LTF-confirmation structure. Two
// things make it worth testing despite the intraday results so far:
//
//   - A 3R target changes the cost arithmetic. At 5m on BTC, 1R is ~0.28% of
//     price and a 0.10% round trip costs ~0.36R. With a 1:1 payoff that needs
//     a 68% win rate; with a 3R target break-even is ~34%, which is an
//     ordinary bar rather than an absurd one.
//   - The earlier 4H->15m->5m cascade that failed used BoS for bias and a
//     fixed time exit. This is a different rule: FVG for the level, FVG for
//     the trigger, R-multiple exit. Related, not the same, so the old result
//     does not settle it.
//
// TIMING DISCIPLINE — the thing that invalidated an earlier version of this
// analysis. OKX candle `time` is the OPEN. A 4H FVG involving candle k is only
// knowable once candle k CLOSES, at time[k] + 4h. Every 5m bar is therefore
// checked against `formedAt` = the 4H candle's close time, never its open.
// Getting this wrong silently grants a 4-hour look-ahead and manufactures an
// edge from nothing.
//
// STOP PLACEMENT is not specified in the request and materially changes R, so
// both plausible readings are tested rather than one being assumed:
//   - 'fvg'  : stop just below the 5m FVG's own bottom (tight, standard SMC)
//   - 'zone' : stop below the 4H FVG's bottom (wide, invalidates the thesis)

const { getCandles } = require('../crypto/binance');
const { detectFVG } = require('../smc');

const H4_SECONDS = 4 * 3600;
const M5_SECONDS = 5 * 60;
const TARGET_R = 3;
const COST_PERCENT = 0.10; // round trip, generous (tight taker both sides)
const MAX_BARS_IN_TRADE = 288; // 24h of 5m bars — a 3R move must arrive or it is dead
const ZONE_STALE_SECONDS = 7 * 86400;
const TRIGGER_WINDOW_BARS = 48; // 4h of 5m bars to produce the 5m FVG after entering the zone

// Unmitigated bullish 4H FVGs, each stamped with the moment it became knowable.
function build4hZones(candles4h, minHistory = 10) {
  const zones = [];
  for (let i = minHistory; i < candles4h.length; i++) {
    const fvg = detectFVG(candles4h.slice(0, i + 1));
    if (fvg && fvg.direction === 'long') {
      zones.push({
        top: fvg.top,
        bottom: fvg.bottom,
        formedAt: candles4h[i].time + H4_SECONDS, // CLOSE, not open
        used: false,
      });
    }
  }
  return zones;
}

function simulate(candles5m, entryIdx, entry, stop) {
  const risk = entry - stop;
  if (!(risk > 0)) return null;
  const target = entry + risk * TARGET_R;
  const costR = COST_PERCENT / ((risk / entry) * 100);
  for (let j = entryIdx + 1; j < Math.min(candles5m.length, entryIdx + 1 + MAX_BARS_IN_TRADE); j++) {
    // Adverse level checked first within a bar — the conservative ordering.
    if (candles5m[j].low <= stop) return { r: -1 - costR, bars: j - entryIdx, how: 'stop' };
    if (candles5m[j].high >= target) return { r: TARGET_R - costR, bars: j - entryIdx, how: 'target' };
  }
  const last = Math.min(candles5m.length - 1, entryIdx + MAX_BARS_IN_TRADE);
  if (last <= entryIdx) return null;
  return { r: (candles5m[last].close - entry) / risk - costR, bars: last - entryIdx, how: 'timeout' };
}

function run(candles4h, candles5m, stopMode) {
  const zones = build4hZones(candles4h);
  const trades = [];
  let zonesTouched = 0;

  for (const zone of zones) {
    // Step 2: first 5m bar that trades into the 4H FVG, after it is knowable.
    let touchIdx = -1;
    for (let k = 2; k < candles5m.length; k++) {
      if (candles5m[k].time < zone.formedAt) continue;
      if (candles5m[k].time - zone.formedAt > ZONE_STALE_SECONDS) break;
      if (candles5m[k].low <= zone.top && candles5m[k].high >= zone.bottom) { touchIdx = k; break; }
    }
    if (touchIdx < 0) continue;
    zonesTouched += 1;

    // Step 3-4: first NEW bullish 5m FVG after the touch. Entry at the close of
    // the bar that completes it — the first moment a bot could act on it.
    for (let k = touchIdx; k < Math.min(candles5m.length - 1, touchIdx + TRIGGER_WINDOW_BARS); k++) {
      const fvg = detectFVG(candles5m.slice(Math.max(0, k - 40), k + 1));
      if (!fvg || fvg.direction !== 'long') continue;
      const entry = candles5m[k].close;
      const stop = stopMode === 'zone'
        ? zone.bottom * 0.999
        : fvg.bottom * 0.999;
      const res = simulate(candles5m, k, entry, stop);
      if (res) trades.push({ ...res, time: candles5m[k].time });
      break; // one trade per zone
    }
  }
  return { zones: zones.length, zonesTouched, trades };
}

function stat(xs) {
  const n = xs.length;
  if (n < 2) return { n, avgR: null, t: null, winRate: null };
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1));
  return {
    n,
    avgR: Math.round(m * 1000) / 1000,
    t: Math.round((m / (sd / Math.sqrt(n))) * 100) / 100,
    winRate: Math.round((xs.filter((x) => x > 0).length / n) * 1000) / 10,
  };
}

if (require.main === module) {
  const symbols = process.argv.slice(2);
  const universe = symbols.length ? symbols : ['BTC-USDT', 'ETH-USDT', 'SOL-USDT'];
  (async () => {
    console.log(`4H FVG -> 5m entry -> ${TARGET_R}R target, cost ${COST_PERCENT}% round trip\n`);
    for (const symbol of universe) {
      let c4h;
      let c5m;
      try {
        c4h = await getCandles(symbol, '4H', 2000, { pauseMs: 110 });
        c5m = await getCandles(symbol, '5m', 20000, { pauseMs: 110 });
      } catch (err) {
        console.log(`${symbol}: fetch failed — ${err.message}`);
        continue;
      }
      const days = (c5m[c5m.length - 1].time - c5m[0].time) / 86400;
      console.log(`${symbol}: ${c4h.length} 4H bars, ${c5m.length} 5m bars (~${days.toFixed(0)} days)`);
      for (const stopMode of ['fvg', 'zone']) {
        const { zones, zonesTouched, trades } = run(c4h, c5m, stopMode);
        const s = stat(trades.map((t) => t.r));
        const hits = trades.filter((t) => t.how === 'target').length;
        const stops = trades.filter((t) => t.how === 'stop').length;
        console.log(
          `  stop=${stopMode.padEnd(5)} zones ${zones}, touched ${zonesTouched}, trades ${s.n}` +
          `  avgR ${String(s.avgR).padStart(7)}  t ${String(s.t).padStart(6)}  win ${String(s.winRate).padStart(5)}%` +
          `  (target ${hits}, stop ${stops})`,
        );
        if (s.n >= 20) {
          const sorted = [...trades].sort((a, b) => a.time - b.time);
          const mid = Math.floor(sorted.length / 2);
          const h1 = stat(sorted.slice(0, mid).map((t) => t.r));
          const h2 = stat(sorted.slice(mid).map((t) => t.r));
          console.log(`           halves: ${h1.avgR} (t ${h1.t}, n ${h1.n})  |  ${h2.avgR} (t ${h2.t}, n ${h2.n})`);
        }
      }
      console.log('');
    }
  })().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { build4hZones, run };
