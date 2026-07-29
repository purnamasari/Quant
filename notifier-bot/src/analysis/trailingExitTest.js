// Does a trailing exit beat the fixed 1.8R target on the validated setup?
//
// Motivation is specific, not exploratory. The user's own diagnosis of past
// losses is "closing too early while the direction was right", and our MFE
// data agrees there is money left on the table: winning trades keep running
// past where a fixed target closes them. A trailing stop is the mechanical
// answer — it lets a winner run while ratcheting protection up behind it, with
// no discretionary decision mid-trade.
//
// Parabolic SAR is Wilder's original formulation, ported here rather than
// copied from je-suis-tm/quant-trading, whose uptrend branch reads
// `sar = max(temp, high[i-1], high[i-2])` — that is the DOWNtrend clamp. In an
// uptrend the SAR sits below price and must be clamped by the prior two LOWS,
// otherwise it can jump above price and exit instantly. Implemented from the
// definition:
//
//   af starts 0.02, +0.02 each time a new extreme prints, capped at 0.2
//   SAR[i] = SAR[i-1] + af * (EP - SAR[i-1])
//   long:  SAR = min(SAR, low[i-1], low[i-2])     (never above recent lows)
//   short: SAR = max(SAR, high[i-1], high[i-2])
//   trend flips when price crosses the SAR
//
// Compared against the live exit rule on identical entries, so the only thing
// that varies is how the trade ends. Everything is measured in R where 1R is
// the ORIGINAL ATR*1.5 stop distance, keeping it comparable to the 0.38-0.50R
// benchmark in data/crypto-signal-validation.md.

const { getDailyCandles } = require('../crypto/okx');
const { walkForwardOccurrences } = require('../stock/backtest');
const { atr } = require('../risk');
const { DEFAULT_VALIDATION_UNIVERSE, RARE_TIER_UNIVERSE } = require('../crypto/universe');

const CONFLUENCE_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming', 'bos-bullish'];
const ATR_STOP = 1.5;
const TARGET_RR = 1.8;
const MAX_HOLD = 7;
const COST_PERCENT = 0.25; // round trip, matches the crypto convention used elsewhere

const MIDCAPS = [
  'DOT-USDT', 'TRX-USDT', 'SUI-USDT', 'NEAR-USDT', 'APT-USDT', 'ICP-USDT',
  'ETC-USDT', 'FIL-USDT', 'ATOM-USDT', 'UNI-USDT', 'AAVE-USDT', 'ARB-USDT',
  'OP-USDT', 'INJ-USDT', 'RENDER-USDT', 'ONDO-USDT', 'HBAR-USDT', 'ALGO-USDT',
];

// Wilder's Parabolic SAR, long-side only (every validated entry here is long).
// Returns the SAR level for each bar from `start` onward, seeded so the first
// stop is the strategy's own ATR stop rather than an arbitrary swing low.
function parabolicSarLong(candles, startIndex, initialStop, { step = 0.02, max = 0.2 } = {}) {
  const levels = [];
  let sar = initialStop;
  let ep = candles[startIndex].high; // extreme point since entry
  let af = step;
  for (let i = startIndex + 1; i < candles.length; i++) {
    sar = sar + af * (ep - sar);
    // A long SAR may never sit above the prior two lows — without this it can
    // leapfrog price and stop the trade out on noise.
    const lows = [candles[i - 1].low];
    if (i - 2 >= 0) lows.push(candles[i - 2].low);
    sar = Math.min(sar, ...lows);
    if (candles[i].high > ep) {
      ep = candles[i].high;
      af = Math.min(af + step, max);
    }
    levels.push({ index: i, sar });
  }
  return levels;
}

// Baseline: exactly what the live bot does today.
function exitFixed(candles, entryIndex, stopDistance) {
  const entry = candles[entryIndex].close;
  const stop = entry - stopDistance;
  const target = entry + stopDistance * TARGET_RR;
  for (let d = 1; d <= MAX_HOLD; d++) {
    const i = entryIndex + d;
    if (i >= candles.length) break;
    if (candles[i].low <= stop) return { r: -1, days: d, how: 'stop' };
    if (candles[i].high >= target) return { r: TARGET_RR, days: d, how: 'target' };
  }
  const i = Math.min(candles.length - 1, entryIndex + MAX_HOLD);
  if (i <= entryIndex) return null;
  return { r: (candles[i].close - entry) / stopDistance, days: i - entryIndex, how: 'timeout' };
}

// Trailing: same initial stop, no fixed target, SAR ratchets behind price.
// maxHold caps it so the comparison is not just "held longer".
function exitTrailing(candles, entryIndex, stopDistance, maxHold) {
  const entry = candles[entryIndex].close;
  const initialStop = entry - stopDistance;
  const sarLevels = parabolicSarLong(candles, entryIndex, initialStop);
  for (const { index, sar } of sarLevels) {
    const d = index - entryIndex;
    if (d > maxHold) break;
    // Conservative ordering: the stop is checked against the bar's low before
    // any favourable move is credited.
    const level = Math.max(initialStop, sar);
    if (candles[index].low <= level) {
      return { r: (level - entry) / stopDistance, days: d, how: d === 1 ? 'stop' : 'trail' };
    }
  }
  const i = Math.min(candles.length - 1, entryIndex + maxHold);
  if (i <= entryIndex) return null;
  return { r: (candles[i].close - entry) / stopDistance, days: i - entryIndex, how: 'timeout' };
}

function summarize(rows, costR) {
  const n = rows.length;
  if (!n) return { trades: 0 };
  const rs = rows.map((x) => x.r - (costR.get(x.key) ?? 0));
  const mean = rs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(rs.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n - 1));
  return {
    trades: n,
    avgR: Math.round(mean * 1000) / 1000,
    t: Math.round((mean / (sd / Math.sqrt(n))) * 100) / 100,
    winRate: Math.round((rs.filter((r) => r > 0).length / n) * 1000) / 10,
    avgDays: Math.round((rows.reduce((s, x) => s + x.days, 0) / n) * 10) / 10,
    maxR: Math.round(Math.max(...rs) * 100) / 100,
  };
}

async function collectTrades(universe, log) {
  const out = [];
  for (const symbol of universe) {
    let candles;
    try {
      candles = await getDailyCandles(symbol, 730);
    } catch (err) {
      log(`  skip ${symbol}: ${err.message}`);
      continue;
    }
    if (!candles || candles.length < 100) continue;
    const occ = walkForwardOccurrences(candles);
    const dayCounts = new Map();
    for (const kind of CONFLUENCE_KINDS) {
      for (const hit of occ[kind] || []) dayCounts.set(hit.index, (dayCounts.get(hit.index) || 0) + 1);
    }
    for (const hit of occ['cup-forming'] || []) {
      if ((dayCounts.get(hit.index) || 0) < 2) continue;
      const i = hit.index;
      const entry = candles[i].close;
      const a = atr(candles.slice(0, i + 1), 14);
      if (!(a > 0) || !(entry > 0) || i + 1 >= candles.length) continue;
      out.push({ symbol, candles, index: i, entry, stopDistance: a * ATR_STOP, time: candles[i].time });
    }
  }
  return out;
}

async function run(universe, label, log = console.log) {
  const trades = await collectTrades(universe, log);
  log(`${label}: ${trades.length} entries`);
  if (!trades.length) return null;

  // Cost expressed in R: a round-trip fee is a % of price, and 1R is the stop
  // distance as a % of price, so cost_in_R = cost% / stop%. Computed per trade
  // because stop width varies a lot across pairs.
  const costR = new Map();
  const rows = { fixed: [], trail7: [], trail14: [], trail21: [] };
  for (const t of trades) {
    const key = `${t.symbol}|${t.index}`;
    costR.set(key, COST_PERCENT / ((t.stopDistance / t.entry) * 100));
    const f = exitFixed(t.candles, t.index, t.stopDistance);
    if (f) rows.fixed.push({ ...f, key });
    for (const [name, hold] of [['trail7', 7], ['trail14', 14], ['trail21', 21]]) {
      const e = exitTrailing(t.candles, t.index, t.stopDistance, hold);
      if (e) rows[name].push({ ...e, key });
    }
  }
  return { rows, costR, trades };
}

function splitHalves(rows, trades) {
  const timeByKey = new Map(trades.map((t) => [`${t.symbol}|${t.index}`, t.time]));
  const sorted = [...rows].sort((a, b) => timeByKey.get(a.key) - timeByKey.get(b.key));
  const mid = Math.floor(sorted.length / 2);
  return [sorted.slice(0, mid), sorted.slice(mid)];
}

if (require.main === module) {
  (async () => {
    console.log(`Trailing exit (Parabolic SAR) vs fixed ${TARGET_RR}R target`);
    console.log(`Same entries, cost ${COST_PERCENT}% round trip converted to R per trade.\n`);

    for (const [label, universe] of [
      ['VALIDATED 12-pair universe', DEFAULT_VALIDATION_UNIVERSE],
      ['OUT-OF-UNIVERSE 18 mid-caps', MIDCAPS],
    ]) {
      console.log('='.repeat(72));
      const res = await run(universe, label);
      if (!res) { console.log('no trades\n'); continue; }
      const { rows, costR, trades } = res;
      console.log('');
      console.log('exit rule'.padEnd(22), 'n'.padStart(5), 'avgR'.padStart(8), 't'.padStart(7), 'win%'.padStart(7), 'days'.padStart(6), 'bestR'.padStart(7));
      for (const [name, label2] of [['fixed', `fixed ${TARGET_RR}R / 7d`], ['trail7', 'SAR trail, 7d cap'], ['trail14', 'SAR trail, 14d cap'], ['trail21', 'SAR trail, 21d cap']]) {
        const s = summarize(rows[name], costR);
        console.log(label2.padEnd(22), String(s.trades).padStart(5), String(s.avgR).padStart(8),
          String(s.t).padStart(7), String(s.winRate).padStart(7), String(s.avgDays).padStart(6), String(s.maxR).padStart(7));
      }
      // Stability: an exit rule that only works in one half is not a rule.
      for (const name of ['fixed', 'trail14']) {
        const [a, b] = splitHalves(rows[name], trades);
        const sa = summarize(a, costR);
        const sb = summarize(b, costR);
        console.log(`   ${name} split -> first: avgR ${sa.avgR} (t ${sa.t}, n ${sa.trades})  |  second: avgR ${sb.avgR} (t ${sb.t}, n ${sb.trades})`);
      }
      console.log('');
    }
  })().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { parabolicSarLong, exitFixed, exitTrailing };
