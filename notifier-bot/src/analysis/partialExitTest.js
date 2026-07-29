// Does partial take-profit + breakeven stop beat a straight 3R target?
//
// The proposal: at +1R take 50% off and move the stop to breakeven, letting the
// rest run to 3R — "so the minimum is 0.5R".
//
// That guarantee is conditional, and the condition is what gets measured here.
// A trade only banks the 0.5R if it REACHES 1R first; one that stops before
// that still loses the full -1R. So the scheme trades a smaller average winner
// for a higher hit rate, and whether that is worth it depends on two numbers
// neither of us can guess: how often price reaches 1R, and how often it comes
// back to entry after doing so.
//
// Five variants over identical entries, so only management differs:
//
//   V1  full position, 3R target                      (the original proposal)
//   V2  50% at 1R, stop to BE, remainder to 3R        (what is being asked)
//   V3  50% at 1R, stop STAYS at -1R, remainder to 3R (isolates the BE move)
//   V4  100% out at 1R                                (no runner at all)
//   V5  50% at 1R, stop to BE, remainder to 2R        (nearer runner target)
//
// V3 matters most: comparing it against V2 separates "taking partials helps"
// from "moving to breakeven helps", which are two different claims that get
// bundled together. Prior MFE work on the daily setup found winners dip a
// median 0.26R before working, so a BE stop is not free — it converts trades
// that would have retraced and then run into scratches.
//
// Intrabar ordering is conservative throughout: when a bar spans both the stop
// and a profit level, the stop is assumed to hit first.

const { getCandles } = require('../crypto/okx');
const { detectFVG } = require('../smc');

const H4_SECONDS = 4 * 3600;
const COST_PERCENT = 0.10;
const MAX_BARS = 288;
const ZONE_STALE_SECONDS = 7 * 86400;
const TRIGGER_WINDOW_BARS = 48;

function build4hZones(c4h, minHistory = 10) {
  const zones = [];
  for (let i = minHistory; i < c4h.length; i++) {
    const fvg = detectFVG(c4h.slice(0, i + 1));
    if (fvg && fvg.direction === 'long') {
      zones.push({ top: fvg.top, bottom: fvg.bottom, formedAt: c4h[i].time + H4_SECONDS });
    }
  }
  return zones;
}

// Returns R for each variant plus diagnostics on what price actually did.
function simulateVariants(candles, entryIdx, entry, stop) {
  const risk = entry - stop;
  if (!(risk > 0)) return null;
  const costR = COST_PERCENT / ((risk / entry) * 100);
  const lvl = (r) => entry + risk * r;

  let reached1R = false;
  let reached3R = false;
  let stoppedBefore1R = false;
  let cameBackToBE = false;
  let exitBarsV2 = 0;

  // Walk once, recording the events every variant needs.
  const events = [];
  for (let j = entryIdx + 1; j < Math.min(candles.length, entryIdx + 1 + MAX_BARS); j++) {
    const bar = candles[j];
    if (bar.low <= stop && !reached1R) { stoppedBefore1R = true; events.push({ j, type: 'stop-initial' }); break; }
    if (!reached1R && bar.high >= lvl(1)) { reached1R = true; events.push({ j, type: 'hit1R' }); }
    if (reached1R) {
      if (bar.low <= entry && !cameBackToBE) { cameBackToBE = true; events.push({ j, type: 'back-to-BE' }); }
      if (bar.high >= lvl(3)) { reached3R = true; events.push({ j, type: 'hit3R' }); break; }
      if (bar.low <= stop) { events.push({ j, type: 'stop-after-1R' }); break; }
    }
    exitBarsV2 = j - entryIdx;
  }

  const lastIdx = Math.min(candles.length - 1, entryIdx + MAX_BARS);
  const finalR = lastIdx > entryIdx ? (candles[lastIdx].close - entry) / risk : 0;

  // V1: full position to 3R, original stop.
  let v1;
  if (stoppedBefore1R) v1 = -1;
  else if (reached3R) v1 = 3;
  else {
    const stoppedAfter = events.some((e) => e.type === 'stop-after-1R');
    v1 = stoppedAfter ? -1 : finalR;
  }

  // V2: 50% at 1R, stop to BE for the runner.
  let v2;
  if (stoppedBefore1R) v2 = -1;
  else if (reached3R) v2 = 0.5 * 1 + 0.5 * 3;
  else if (cameBackToBE) v2 = 0.5 * 1 + 0.5 * 0;
  else v2 = 0.5 * 1 + 0.5 * finalR;

  // V3: 50% at 1R, stop stays at -1R.
  let v3;
  if (stoppedBefore1R) v3 = -1;
  else if (reached3R) v3 = 0.5 * 1 + 0.5 * 3;
  else {
    const stoppedAfter = events.some((e) => e.type === 'stop-after-1R');
    v3 = stoppedAfter ? 0.5 * 1 + 0.5 * -1 : 0.5 * 1 + 0.5 * finalR;
  }

  // V4: everything out at 1R.
  const v4 = stoppedBefore1R ? -1 : 1;

  // V5: 50% at 1R, BE stop, runner targets 2R.
  let v5;
  const reached2R = events.some((e) => e.type === 'hit3R')
    || candles.slice(entryIdx + 1, lastIdx + 1).some((b) => b.high >= lvl(2));
  if (stoppedBefore1R) v5 = -1;
  else if (reached2R && !cameBackToBE) v5 = 0.5 * 1 + 0.5 * 2;
  else if (cameBackToBE) v5 = 0.5 * 1 + 0.5 * 0;
  else v5 = 0.5 * 1 + 0.5 * finalR;

  return {
    v1: v1 - costR,
    v2: v2 - costR,
    v3: v3 - costR,
    v4: v4 - costR,
    v5: v5 - costR,
    reached1R,
    reached3R,
    stoppedBefore1R,
    cameBackToBE,
  };
}

function collect(c4h, c5m, stopMode) {
  const zones = build4hZones(c4h);
  const out = [];
  for (const zone of zones) {
    let touch = -1;
    for (let k = 2; k < c5m.length; k++) {
      if (c5m[k].time < zone.formedAt) continue;
      if (c5m[k].time - zone.formedAt > ZONE_STALE_SECONDS) break;
      if (c5m[k].low <= zone.top && c5m[k].high >= zone.bottom) { touch = k; break; }
    }
    if (touch < 0) continue;
    for (let k = touch; k < Math.min(c5m.length - 1, touch + TRIGGER_WINDOW_BARS); k++) {
      const fvg = detectFVG(c5m.slice(Math.max(0, k - 40), k + 1));
      if (!fvg || fvg.direction !== 'long') continue;
      const entry = c5m[k].close;
      const stop = (stopMode === 'zone' ? zone.bottom : fvg.bottom) * 0.999;
      const r = simulateVariants(c5m, k, entry, stop);
      if (r) out.push(r);
      break;
    }
  }
  return out;
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
  const universe = process.argv.slice(2).length ? process.argv.slice(2)
    : ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'BNB-USDT', 'XRP-USDT'];
  (async () => {
    const all = { fvg: [], zone: [] };
    for (const symbol of universe) {
      let c4h; let c5m;
      try {
        c4h = await getCandles(symbol, '4H', 2000, { pauseMs: 110 });
        c5m = await getCandles(symbol, '5m', 20000, { pauseMs: 110 });
      } catch (err) { console.log(`${symbol}: ${err.message}`); continue; }
      for (const mode of ['fvg', 'zone']) all[mode].push(...collect(c4h, c5m, mode));
      console.log(`${symbol} done`);
    }
    for (const mode of ['fvg', 'zone']) {
      const rows = all[mode];
      if (!rows.length) continue;
      console.log(`\n${'='.repeat(66)}\nstop = ${mode}   (n=${rows.length}, all pairs pooled)\n`);
      const r1 = rows.filter((r) => r.reached1R).length;
      const bk = rows.filter((r) => r.reached1R && r.cameBackToBE).length;
      console.log(`  reached +1R at all      : ${r1}/${rows.length} (${Math.round((r1 / rows.length) * 100)}%)`);
      console.log(`  of those, fell back to BE: ${bk}/${r1} (${r1 ? Math.round((bk / r1) * 100) : 0}%)`);
      console.log(`  reached +3R             : ${rows.filter((r) => r.reached3R).length}/${rows.length}\n`);
      console.log('  variant'.padEnd(46), 'avgR'.padStart(8), 't'.padStart(7), 'win%'.padStart(7));
      for (const [k, label] of [
        ['v1', 'V1  full position -> 3R'],
        ['v2', 'V2  50% at 1R, stop->BE, rest 3R  (asked)'],
        ['v3', 'V3  50% at 1R, stop STAYS, rest 3R'],
        ['v4', 'V4  100% out at 1R'],
        ['v5', 'V5  50% at 1R, stop->BE, rest 2R'],
      ]) {
        const s = stat(rows.map((r) => r[k]));
        console.log('  ' + label.padEnd(44), String(s.avgR).padStart(8), String(s.t).padStart(7), String(s.winRate).padStart(7));
      }
    }
  })().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { simulateVariants, collect };
