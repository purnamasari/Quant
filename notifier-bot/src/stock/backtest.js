// Aggregate, universe-wide backtest per signal kind — the fix for the
// "thin per-symbol sample" problem discussed for purnamasari/quant's
// `runBacktest` (src/shared/quant.ts), which only backtests one strategy
// ("Breakout confirmation") on one symbol at a time.
//
// Approach: walk every symbol's history day-by-day, re-run the same
// point-in-time `detectStockSignals` used live, and whenever a signal kind
// fires, measure the forward return over `holdDays` trading days. Results
// are pooled across the whole universe and across signal kinds, so sample
// sizes are large enough to actually judge expectancy — and pairwise
// correlation between signal kinds tells us which ones are redundant
// (same purpose as the correlation analysis in src/analysis/correlateSignals.js).

const { detectStockSignals } = require('./signals');
const { getChart } = require('./yahoo');
const { getUniverse } = require('./universe');

// opts is forwarded verbatim to detectStockSignals so a backtest can measure
// the same thresholds the live caller uses (see src/crypto/backtest.js).
function walkForwardOccurrences(candles, minHistory = 55, opts = {}) {
  // occurrences[kind] = array of { index, score, direction }
  const occurrences = {};
  for (let i = minHistory; i < candles.length; i++) {
    const window = candles.slice(0, i + 1);
    const { signals } = detectStockSignals(window, opts);
    for (const s of signals) {
      if (!occurrences[s.kind]) occurrences[s.kind] = [];
      occurrences[s.kind].push({ index: i, score: s.score, direction: s.direction || 'long' });
    }
  }
  return occurrences;
}

// PnL-style return: for 'short' signals, profit comes from the price
// FALLING, so the raw price return is inverted before it's pooled with
// long-signal returns — this makes expectancy directly comparable across
// both directions (positive = the trade direction was right).
function forwardReturn(candles, entryIndex, holdDays, direction = 'long') {
  const exitIndex = Math.min(candles.length - 1, entryIndex + holdDays);
  if (exitIndex <= entryIndex) return null;
  const entryClose = candles[entryIndex].close;
  const exitClose = candles[exitIndex].close;
  if (!(entryClose > 0)) return null;
  const priceReturn = ((exitClose - entryClose) / entryClose) * 100;
  return direction === 'short' ? -priceReturn : priceReturn;
}

// costPercent: assumed round-trip friction (spread + slippage + any fee) in
// percentage points, subtracted from every trade's return before stats are
// computed. Added because raw backtest expectancy here (0.1-0.6%) is thin
// enough that realistic execution costs can flip several signals negative —
// see data/stock-signal-validation.md "Transaction cost sensitivity".
function summarize(rawReturns, costPercent = 0) {
  const returns = costPercent ? rawReturns.map((r) => r - costPercent) : rawReturns;
  const n = returns.length;
  if (!n) return { trades: 0, winRate: null, avgReturn: null, expectancy: null };
  const wins = returns.filter((r) => r > 0);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / n;
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const losses = returns.filter((r) => r <= 0);
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  const winRate = (wins.length / n) * 100;
  return {
    trades: n,
    winRate: Math.round(winRate * 10) / 10,
    avgReturn: Math.round(avgReturn * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    // simple expectancy in % terms, analogous to quant.ts's R-based expectancy
    expectancy: Math.round(((winRate / 100) * avgWin - (1 - winRate / 100) * Math.abs(avgLoss)) * 100) / 100,
  };
}

async function runUniverseBacktest({ range = '10y', holdDays = 2, symbols = null, log = console.log, costPercent = 0 } = {}) {
  const universe = symbols || getUniverse();
  const perKindReturns = {};
  const perSymbolFireDays = {}; // symbol -> { kind: Set(dayIndex) } for correlation analysis
  let symbolsUsed = 0;

  for (const entry of universe) {
    const symbol = entry.symbol;
    let candles;
    try {
      const chart = await getChart(symbol, range, '1d');
      candles = chart.candles;
    } catch (err) {
      log(`[backtest] skip ${symbol}: ${err.message}`);
      continue;
    }
    if (candles.length < 100) continue;
    symbolsUsed += 1;

    const occurrences = walkForwardOccurrences(candles);
    perSymbolFireDays[symbol] = {};
    for (const [kind, hits] of Object.entries(occurrences)) {
      perSymbolFireDays[symbol][kind] = new Set(hits.map((h) => h.index));
      if (!perKindReturns[kind]) perKindReturns[kind] = [];
      for (const hit of hits) {
        const ret = forwardReturn(candles, hit.index, holdDays, hit.direction);
        if (ret !== null) perKindReturns[kind].push(ret);
      }
    }
  }

  const summaryByKind = {};
  for (const [kind, returns] of Object.entries(perKindReturns)) {
    summaryByKind[kind] = summarize(returns, costPercent);
  }

  return { symbolsUsed, holdDays, range, summaryByKind, perSymbolFireDays };
}

if (require.main === module) {
  const holdDays = Number(process.env.HOLD_DAYS || 2);
  runUniverseBacktest({ holdDays }).then((result) => {
    console.log(`\nUniverse backtest — ${result.symbolsUsed} symbols, ${result.range} history, ${result.holdDays}-day hold\n`);
    const rows = Object.entries(result.summaryByKind).sort((a, b) => (b[1].expectancy ?? -999) - (a[1].expectancy ?? -999));
    for (const [kind, s] of rows) {
      console.log(
        `${kind.padEnd(16)} trades=${String(s.trades).padEnd(6)} winRate=${String(s.winRate).padEnd(6)}% avgReturn=${String(s.avgReturn).padEnd(7)}% expectancy=${s.expectancy}%`,
      );
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runUniverseBacktest, walkForwardOccurrences, forwardReturn, summarize };
