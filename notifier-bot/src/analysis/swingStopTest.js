// Does the parent Quant project's stop method beat ours?
//
// notifier-bot's risk.js uses a flat ATR*1.5 stop. The desktop Quant app
// (src/shared/quant.ts) defaults to stopMethod:'swing' instead:
//
//     stop = min(nearestSupport, entry - ATR*0.7)
//
// i.e. park the stop under the nearest confirmed pivot low, with an ATR*0.7
// floor so it can never sit absurdly tight. That is a structural stop rather
// than a volatility one, and it matters twice over here: it changes the
// measured R-multiple, and because stop width sets max leverage
// (positionSizing.js), it changes how much leverage the setup can carry.
//
// LOOK-AHEAD HAZARD, handled explicitly: a pivot at bar p is only detectable
// once k more bars have printed (it must be the extreme of its +/-k
// neighbourhood). Using pivots discovered from the full series would leak the
// future. Every pivot used below must satisfy p + k <= signalIndex.
//
// Pivot detection is ported from src/renderer/components/chart/analysis.ts
// (isPivotAt / findPivots) in the parent repo.

const { getDailyCandles } = require('../crypto/binance');
const { walkForwardOccurrences } = require('../stock/backtest');
const { atr } = require('../risk');

const CONFLUENCE_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming', 'bos-bullish'];
const HOLD_DAYS = 7;
const TARGET_RR = 1.8;
const ATR_STOP_MULTIPLIER = 1.5;
const SWING_ATR_FLOOR = 0.7; // Quant's floor: entry - ATR*0.7

function isPivotAt(candles, i, k, kind) {
  const value = kind === 'high' ? candles[i].high : candles[i].low;
  for (let j = i - k; j <= i + k; j++) {
    if (j === i || j < 0 || j >= candles.length) continue;
    const other = kind === 'high' ? candles[j].high : candles[j].low;
    // Ties resolve to the FIRST candle of a run, matching analysis.ts.
    if (kind === 'high') {
      if (other > value) return false;
      if (other === value && j < i) return false;
    } else {
      if (other < value) return false;
      if (other === value && j < i) return false;
    }
  }
  return true;
}

// Nearest confirmed pivot low strictly below entry — the support the stop
// hides under. Only pivots confirmed by signalIndex are eligible.
function nearestSupportBelow(candles, signalIndex, entry, k) {
  let best = null;
  for (let p = k; p + k <= signalIndex; p++) {
    if (!isPivotAt(candles, p, k, 'low')) continue;
    const price = candles[p].low;
    if (price >= entry) continue;
    if (best === null || price > best) best = price; // closest below entry
  }
  return best;
}

function simulate(candles, entryIndex, stopPrice, maxHold) {
  const entry = candles[entryIndex].close;
  const stopDistance = entry - stopPrice;
  if (!(stopDistance > 0)) return null;
  const target = entry + stopDistance * TARGET_RR;
  for (let d = 1; d <= maxHold; d++) {
    const idx = entryIndex + d;
    if (idx >= candles.length) break;
    const bar = candles[idx];
    if (bar.low <= stopPrice) return { r: -1, stopPct: (stopDistance / entry) * 100 };
    if (bar.high >= target) return { r: TARGET_RR, stopPct: (stopDistance / entry) * 100 };
  }
  const exitIdx = Math.min(candles.length - 1, entryIndex + maxHold);
  if (exitIdx <= entryIndex) return null;
  return {
    r: (candles[exitIdx].close - entry) / stopDistance,
    stopPct: (stopDistance / entry) * 100,
  };
}

function summarize(rows) {
  const n = rows.length;
  if (!n) return { trades: 0 };
  const rs = rows.map((x) => x.r);
  return {
    trades: n,
    winRate: Math.round((rs.filter((r) => r > 0).length / n) * 1000) / 10,
    avgR: Math.round((rs.reduce((a, b) => a + b, 0) / n) * 1000) / 1000,
    avgStopPct: Math.round((rows.reduce((s, x) => s + x.stopPct, 0) / n) * 100) / 100,
    maxLeverage: Math.round((95 / (rows.reduce((s, x) => s + x.stopPct, 0) / n) / 2) * 10) / 10,
  };
}

async function run({ universe, pivotWindows = [3, 5, 8], log = console.log } = {}) {
  const atrRows = [];
  const swingRows = {};
  for (const k of pivotWindows) swingRows[k] = [];
  const perSymbol = {};

  for (const symbol of universe) {
    let candles;
    try {
      candles = await getDailyCandles(symbol, 730);
    } catch (err) {
      log(`[swingStopTest] skip ${symbol}: ${err.message}`);
      continue;
    }
    if (!candles || candles.length < 100) {
      log(`[swingStopTest] ${symbol}: only ${candles?.length ?? 0} candles`);
      continue;
    }

    const occurrences = walkForwardOccurrences(candles);
    const dayCounts = new Map();
    for (const kind of CONFLUENCE_KINDS) {
      for (const hit of occurrences[kind] || []) {
        dayCounts.set(hit.index, (dayCounts.get(hit.index) || 0) + 1);
      }
    }

    const symbolRows = [];
    for (const hit of occurrences['cup-forming'] || []) {
      if ((dayCounts.get(hit.index) || 0) < 2) continue;
      const i = hit.index;
      const entry = candles[i].close;
      const a = atr(candles.slice(0, i + 1), 14);
      if (!(a > 0) || !(entry > 0)) continue;

      const atrResult = simulate(candles, i, entry - a * ATR_STOP_MULTIPLIER, HOLD_DAYS);
      if (atrResult) { atrRows.push(atrResult); symbolRows.push(atrResult); }

      for (const k of pivotWindows) {
        const support = nearestSupportBelow(candles, i, entry, k);
        // Quant: stop = min(support, entry - ATR*0.7). No support found ->
        // fall back to the ATR floor alone.
        const floor = entry - a * SWING_ATR_FLOOR;
        const stopPrice = support === null ? floor : Math.min(support, floor);
        const res = simulate(candles, i, stopPrice, HOLD_DAYS);
        if (res) swingRows[k].push(res);
      }
    }
    if (symbolRows.length) perSymbol[symbol] = summarize(symbolRows);
  }

  return { atr: summarize(atrRows), swing: Object.fromEntries(pivotWindows.map((k) => [k, summarize(swingRows[k])])), perSymbol };
}

if (require.main === module) {
  const universe = process.argv.slice(2);
  if (!universe.length) {
    console.error('usage: node src/analysis/swingStopTest.js SYM-USDT [SYM-USDT ...]');
    process.exit(1);
  }
  run({ universe }).then(({ atr: atrSummary, swing, perSymbol }) => {
    console.log(`\n=== Stop method comparison — cup-forming + confluence, ${HOLD_DAYS}d hold, 1.8R target ===\n`);
    console.log('method'.padEnd(26), 'n'.padStart(5), 'winRate'.padStart(9), 'avgR'.padStart(8), 'stop%'.padStart(8), 'maxLev'.padStart(8));
    const line = (label, s) => console.log(
      label.padEnd(26), String(s.trades).padStart(5), String((s.winRate ?? '-') + '%').padStart(9),
      String(s.avgR ?? '-').padStart(8), String(s.avgStopPct ?? '-').padStart(8), String((s.maxLeverage ?? '-') + 'x').padStart(8),
    );
    line('ATR*1.5 (current)', atrSummary);
    for (const [k, s] of Object.entries(swing)) line(`swing stop (pivot k=${k})`, s);

    console.log(`\n=== Per-symbol, ATR stop (watchlist validation) ===`);
    for (const [symbol, s] of Object.entries(perSymbol)) {
      console.log(`  ${symbol.padEnd(12)} n=${String(s.trades).padStart(3)}  wr=${String(s.winRate + '%').padStart(6)}  avgR=${String(s.avgR).padStart(7)}`);
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run, nearestSupportBelow, isPivotAt };
