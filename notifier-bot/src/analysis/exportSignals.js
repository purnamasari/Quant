// Exports the validated setup's candles and signal dates as JSON so the Python
// analysis layer can work on exactly what the live bot would see.
//
// This is the seam described in TRADING_BOT_PLAN.md §3: the JS signal engine
// stays authoritative because it is the only heavily-validated code here, and
// anything downstream reads its output rather than reimplementing it. A Python
// reimplementation of the detectors would be indistinguishable from an edge
// that quietly broke.

const fs = require('node:fs');
const path = require('node:path');
const { getDailyCandles } = require('../crypto/okx');
const { walkForwardOccurrences } = require('../stock/backtest');
const { atr } = require('../risk');
const { DEFAULT_VALIDATION_UNIVERSE } = require('../crypto/universe');

const CONFLUENCE_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming', 'bos-bullish'];
const MIDCAPS = [
  'DOT-USDT', 'TRX-USDT', 'SUI-USDT', 'NEAR-USDT', 'APT-USDT', 'ICP-USDT',
  'ETC-USDT', 'FIL-USDT', 'ATOM-USDT', 'UNI-USDT', 'AAVE-USDT', 'ARB-USDT',
  'OP-USDT', 'INJ-USDT', 'RENDER-USDT', 'ONDO-USDT', 'HBAR-USDT', 'ALGO-USDT',
];
const OUT_DIR = path.join(__dirname, '..', '..', 'data', 'export');

async function exportSymbol(symbol, universeLabel) {
  const candles = await getDailyCandles(symbol, 730);
  if (!candles || candles.length < 100) return null;

  const occ = walkForwardOccurrences(candles);
  const dayCounts = new Map();
  for (const kind of CONFLUENCE_KINDS) {
    for (const hit of occ[kind] || []) dayCounts.set(hit.index, (dayCounts.get(hit.index) || 0) + 1);
  }

  const signals = [];
  for (const hit of occ['cup-forming'] || []) {
    if ((dayCounts.get(hit.index) || 0) < 2) continue;
    const i = hit.index;
    const a = atr(candles.slice(0, i + 1), 14);
    const entry = candles[i].close;
    if (!(a > 0) || !(entry > 0)) continue;
    signals.push({
      index: i,
      time: candles[i].time,
      entry,
      // ATR as the live bot computes it — kept so the Python side can compare
      // a GARCH forecast against the estimator actually in production rather
      // than against a fresh one it invented.
      atr14: a,
      stopDistance: a * 1.5,
      confluence: dayCounts.get(i),
    });
  }

  return {
    symbol,
    universe: universeLabel,
    candles: candles.map((c) => ({ t: c.time, o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume })),
    signals,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sets = [
    ['validated', DEFAULT_VALIDATION_UNIVERSE],
    ['midcap', MIDCAPS],
  ];
  let totalSignals = 0;
  for (const [label, universe] of sets) {
    for (const symbol of universe) {
      try {
        const data = await exportSymbol(symbol, label);
        if (!data) { console.log(`  skip ${symbol}: insufficient candles`); continue; }
        fs.writeFileSync(path.join(OUT_DIR, `${symbol}.json`), JSON.stringify(data));
        totalSignals += data.signals.length;
        console.log(`  ${symbol.padEnd(12)} ${data.candles.length} candles, ${data.signals.length} signals`);
      } catch (err) {
        console.log(`  skip ${symbol}: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  console.log(`\nexported to data/export/ — ${totalSignals} signals total`);
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { exportSymbol };
