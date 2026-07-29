// The validated setup, run on 4H candles instead of daily.
//
// Motivation: at 4H a 0.25% round trip costs ~0.06R against ~0.03R daily, so
// unlike 5m (0.36R) or 1m (1.16R) the cost structure still permits an edge.
// This is the honest route to higher frequency; scalping is not.
//
// IMPORTANT — this is NOT "the same setup, more often". The detectors in
// src/stock/signals.js hardcode their lookbacks in BARS, not calendar time:
// slice(-252) is one year on daily candles and 42 days on 4H, slice(-50) drops
// from ~2.5 months to 8 days, and the volume baseline from 20 days to 3.3.
// Every window silently compresses by 6x, so `near-52w-high` becomes
// `near-42d-high`. The pattern shapes are identical; what they measure is not.
// Running it unmodified is the version worth testing — rescaling the lookbacks
// would mostly reproduce the daily signal sampled six times over — but the
// result has to be read as a related signal, not the same one.
//
// Everything else is held identical to the daily validation so the comparison
// is fair: same confluence requirement, same ATR*1.5 stop, no fixed target,
// same 0.25% round-trip cost, and the same random-entry control that showed
// the daily period gave nothing away for free (0.003R).

const fs = require('node:fs');
const path = require('node:path');
const { getCandles } = require('../crypto/okx');
const { walkForwardOccurrences } = require('../stock/backtest');
const { atr } = require('../risk');
const { DEFAULT_VALIDATION_UNIVERSE } = require('../crypto/universe');

const CONFLUENCE_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming', 'bos-bullish'];
const COST_PERCENT = 0.25; // identical to the daily validation, deliberately
const CACHE = path.join(__dirname, '..', '..', 'data', 'export-4h');
const MIDCAPS = [
  'DOT-USDT', 'TRX-USDT', 'SUI-USDT', 'NEAR-USDT', 'APT-USDT', 'ICP-USDT',
  'ETC-USDT', 'FIL-USDT', 'ATOM-USDT', 'UNI-USDT', 'AAVE-USDT', 'ARB-USDT',
  'OP-USDT', 'INJ-USDT', 'RENDER-USDT', 'ONDO-USDT', 'HBAR-USDT', 'ALGO-USDT',
];
// 2.3 / 5 / 7 / 14 calendar days at 6 bars per day.
const HOLD_BARS = [14, 30, 42, 84];

async function candlesFor(symbol) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `${symbol}.json`);
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* refetch */ }
  }
  const c = await getCandles(symbol, '4H', 4380, { pauseMs: 110 });
  fs.writeFileSync(file, JSON.stringify(c));
  return c;
}

function simulate(candles, i, holdBars) {
  const entry = candles[i].close;
  const a = atr(candles.slice(0, i + 1), 14);
  if (!(a > 0) || !(entry > 0)) return null;
  const sd = a * 1.5;
  const stop = entry - sd;
  const costR = COST_PERCENT / ((sd / entry) * 100);
  for (let d = 1; d <= holdBars; d++) {
    const j = i + d;
    if (j >= candles.length) break;
    if (candles[j].low <= stop) return -1 - costR;
  }
  const j = Math.min(candles.length - 1, i + holdBars);
  if (j <= i) return null;
  return (candles[j].close - entry) / sd - costR;
}

function stat(xs) {
  const v = xs.filter(Number.isFinite);
  const n = v.length;
  if (n < 2) return { n, avgR: null, t: null, win: null };
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1));
  return {
    n,
    avgR: Math.round(m * 1000) / 1000,
    t: Math.round((m / (sd / Math.sqrt(n))) * 100) / 100,
    win: Math.round((v.filter((x) => x > 0).length / n) * 1000) / 10,
  };
}

let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

async function run(universe, label) {
  const byHold = Object.fromEntries(HOLD_BARS.map((h) => [h, []]));
  const randomByHold = Object.fromEntries(HOLD_BARS.map((h) => [h, []]));
  const timed = [];
  let bars = 0;

  for (const symbol of universe) {
    let c;
    try { c = await candlesFor(symbol); } catch (err) { console.log(`  skip ${symbol}: ${err.message}`); continue; }
    if (!c || c.length < 400) continue;
    bars = c.length;
    const occ = walkForwardOccurrences(c, 260);
    const dayCounts = new Map();
    for (const kind of CONFLUENCE_KINDS) {
      for (const hit of occ[kind] || []) dayCounts.set(hit.index, (dayCounts.get(hit.index) || 0) + 1);
    }
    const hits = (occ['cup-forming'] || []).filter((h) => (dayCounts.get(h.index) || 0) >= 2);
    for (const h of hits) {
      for (const hold of HOLD_BARS) {
        const r = simulate(c, h.index, hold);
        if (r !== null) byHold[hold].push(r);
        if (hold === 84 && r !== null) timed.push({ t: c[h.index].time, v: r });
      }
    }
    // Random control, 10x the signal count, same pair and window.
    for (let k = 0; k < hits.length * 10; k++) {
      const i = 300 + Math.floor(rnd() * (c.length - 300 - 90));
      for (const hold of HOLD_BARS) {
        const r = simulate(c, i, hold);
        if (r !== null) randomByHold[hold].push(r);
      }
    }
    process.stdout.write('.');
  }
  console.log('');
  console.log(`\n=== ${label} (4H, ${bars} bars/pair ≈ ${(bars / 6 / 365).toFixed(1)}y) ===\n`);
  console.log('hold'.padEnd(16), 'signal'.padStart(30), 'random'.padStart(24), 'diff'.padStart(9));
  for (const hold of HOLD_BARS) {
    const s = stat(byHold[hold]);
    const r = stat(randomByHold[hold]);
    const diff = s.avgR !== null && r.avgR !== null ? (s.avgR - r.avgR).toFixed(3) : '-';
    console.log(
      `${hold} bars (${(hold / 6).toFixed(1)}d)`.padEnd(16),
      `n=${String(s.n).padStart(4)} ${String(s.avgR).padStart(7)}R t=${String(s.t).padStart(6)} w=${String(s.win).padStart(5)}%`.padStart(30),
      `n=${String(r.n).padStart(5)} ${String(r.avgR).padStart(7)}R`.padStart(24),
      String(diff).padStart(9),
    );
  }
  if (timed.length > 20) {
    timed.sort((a, b) => a.t - b.t);
    const mid = Math.floor(timed.length / 2);
    const h1 = stat(timed.slice(0, mid).map((x) => x.v));
    const h2 = stat(timed.slice(mid).map((x) => x.v));
    console.log(`\n  84-bar halves: ${h1.avgR} (t ${h1.t}, n ${h1.n})  |  ${h2.avgR} (t ${h2.t}, n ${h2.n})`);
  }
}

if (require.main === module) {
  (async () => {
    await run(DEFAULT_VALIDATION_UNIVERSE, 'validated 12');
    await run(MIDCAPS, 'out-of-universe 18 mid-caps');
    console.log('\nDaily benchmark for comparison: 0.949R (t 5.49, n=118), random 0.003R');
  })().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { run };
