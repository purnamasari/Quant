// Dual Thrust — opening range breakout, ported from je-suis-tm/quant-trading.
//
// The rule, faithfully:
//   range1 = max(high, N) - min(close, N)
//   range2 = max(close, N) - min(low, N)
//   range  = max(range1, range2)
//   sigup  = open + k * range
//   long when price breaks sigup
//
// Worth testing on crypto specifically because it anchors on the OPEN of the
// period, and crypto has a hard UTC daily boundary — unlike equities, where
// the concept came from a session that this bot cannot observe anyway.
//
// The source repo states plainly that its backtests assume "no slippage, no
// surcharge, no illiquidity", so its results carry no weight here. Only the
// rule is borrowed; the evidence is generated from scratch under this
// project's own pipeline: 12 validated pairs plus 18 out-of-universe mid-caps,
// 0.25% round-trip cost, split-half stability, and — the control that matters
// most — a comparison against random entries over the same pairs and period,
// since a rising market makes almost any long look profitable.

const { getDailyCandles } = require('../crypto/binance');
const { atr } = require('../risk');
const { DEFAULT_VALIDATION_UNIVERSE } = require('../crypto/universe');

const MIDCAPS = [
  'DOT-USDT', 'TRX-USDT', 'SUI-USDT', 'NEAR-USDT', 'APT-USDT', 'ICP-USDT',
  'ETC-USDT', 'FIL-USDT', 'ATOM-USDT', 'UNI-USDT', 'AAVE-USDT', 'ARB-USDT',
  'OP-USDT', 'INJ-USDT', 'RENDER-USDT', 'ONDO-USDT', 'HBAR-USDT', 'ALGO-USDT',
];
const COST_PERCENT = 0.25;
const ATR_STOP = 1.5;
const HOLD_DAYS = 14; // the exit rule validated in trailingExitTest.js

function dualThrustRange(candles, i, n) {
  if (i < n) return null;
  const w = candles.slice(i - n, i);
  const maxHigh = Math.max(...w.map((c) => c.high));
  const minClose = Math.min(...w.map((c) => c.close));
  const maxClose = Math.max(...w.map((c) => c.close));
  const minLow = Math.min(...w.map((c) => c.low));
  return Math.max(maxHigh - minClose, maxClose - minLow);
}

// A breakout is detected on bar i when its high pierces the threshold set from
// that bar's own open. Entry is taken at the CLOSE of bar i — the first moment
// the bot could actually act, since it only sees completed candles.
function findBreakouts(candles, { n = 4, k = 0.5 } = {}) {
  const hits = [];
  for (let i = n; i < candles.length - 1; i++) {
    const range = dualThrustRange(candles, i, n);
    if (!(range > 0)) continue;
    const sigup = candles[i].open + k * range;
    if (candles[i].high >= sigup && candles[i].close > candles[i].open) hits.push(i);
  }
  return hits;
}

function simulate(candles, i) {
  const entry = candles[i].close;
  const a = atr(candles.slice(0, i + 1), 14);
  if (!(a > 0) || !(entry > 0)) return null;
  const sd = a * ATR_STOP;
  const stop = entry - sd;
  for (let d = 1; d <= HOLD_DAYS; d++) {
    const j = i + d;
    if (j >= candles.length) break;
    if (candles[j].low <= stop) return { r: -1, costR: COST_PERCENT / ((sd / entry) * 100) };
  }
  const j = Math.min(candles.length - 1, i + HOLD_DAYS);
  if (j <= i) return null;
  return { r: (candles[j].close - entry) / sd, costR: COST_PERCENT / ((sd / entry) * 100) };
}

function stat(xs) {
  const n = xs.length;
  if (n < 2) return { n, avgR: null, t: null };
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1));
  return {
    n,
    avgR: Math.round(m * 1000) / 1000,
    t: Math.round((m / (sd / Math.sqrt(n))) * 100) / 100,
    winRate: Math.round((xs.filter((x) => x > 0).length / n) * 1000) / 10,
  };
}

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

async function run(universe, label, params) {
  const signal = [];
  const random = [];
  const timed = [];
  for (const symbol of universe) {
    let candles;
    try {
      candles = await getDailyCandles(symbol, 730);
    } catch {
      continue;
    }
    if (!candles || candles.length < 100) continue;
    const hits = findBreakouts(candles, params);
    for (const i of hits) {
      const s = simulate(candles, i);
      if (!s) continue;
      signal.push(s.r - s.costR);
      timed.push({ t: candles[i].time, v: s.r - s.costR });
    }
    for (let x = 0; x < hits.length * 10; x++) {
      const i = 60 + Math.floor(rnd() * (candles.length - 60 - HOLD_DAYS - 1));
      const s = simulate(candles, i);
      if (s) random.push(s.r - s.costR);
    }
  }
  const S = stat(signal);
  const R = stat(random);
  let tDiff = null;
  if (S.t && R.t && S.avgR !== null && R.avgR !== null) {
    const seS = Math.abs(S.avgR / S.t);
    const seR = Math.abs(R.avgR / R.t);
    tDiff = Math.round(((S.avgR - R.avgR) / Math.sqrt(seS ** 2 + seR ** 2)) * 100) / 100;
  }
  timed.sort((a, b) => a.t - b.t);
  const mid = Math.floor(timed.length / 2);
  const h1 = stat(timed.slice(0, mid).map((x) => x.v));
  const h2 = stat(timed.slice(mid).map((x) => x.v));
  return { label, S, R, tDiff, h1, h2 };
}

if (require.main === module) {
  (async () => {
    console.log(`Dual Thrust breakout, ${HOLD_DAYS}-day hold, ATR*${ATR_STOP} stop, ${COST_PERCENT}% cost\n`);
    for (const params of [{ n: 4, k: 0.5 }, { n: 4, k: 0.7 }, { n: 10, k: 0.5 }]) {
      console.log('='.repeat(70));
      console.log(`params: lookback ${params.n}, k ${params.k}`);
      for (const [lbl, uni] of [['validated 12', DEFAULT_VALIDATION_UNIVERSE], ['out-of-universe 18', MIDCAPS]]) {
        const r = await run(uni, lbl, params);
        console.log(`  ${lbl}`);
        console.log(`    signal : n=${String(r.S.n).padStart(4)} avgR ${String(r.S.avgR).padStart(7)} t ${String(r.S.t).padStart(6)} win ${r.S.winRate}%`);
        console.log(`    random : n=${String(r.R.n).padStart(4)} avgR ${String(r.R.avgR).padStart(7)} t ${String(r.R.t).padStart(6)}`);
        console.log(`    signal beats random by ${r.S.avgR !== null && r.R.avgR !== null ? (r.S.avgR - r.R.avgR).toFixed(3) : '-'}R  (t ${r.tDiff}) ` +
          `${r.tDiff !== null && Math.abs(r.tDiff) > 2 ? '<= real' : '<= NOT significant'}`);
        console.log(`    halves : ${r.h1.avgR} (t ${r.h1.t}) | ${r.h2.avgR} (t ${r.h2.t})`);
      }
      console.log('');
    }
  })().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { findBreakouts, dualThrustRange };
