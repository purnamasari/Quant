// How much leverage can the validated cup-forming+confluence setup actually
// survive? This is NOT a question of "how much money do you risk" — it's a
// question of whether the strategy's edge can still be expressed at all.
//
// The mechanism: with isolated margin at leverage L, the exchange liquidates
// you at roughly a (1/L) adverse move. Our strategy's stop sits at ATR*1.5
// away from entry. If (1/L) < that stop distance, the LIQUIDATION becomes
// your effective stop — tighter than the one the edge was measured with.
// The edge doesn't shrink proportionally; it collapses, because the setup
// needs room to breathe and you're now stopped out by ordinary noise.
//
// So this script re-simulates every historical cup-forming+confluence trade
// at a grid of leverages, replacing the intended stop with whichever comes
// first (liquidation or the real stop), and reports:
//   - avgR in the ORIGINAL R units (1R = ATR*1.5 move), so it's directly
//     comparable to the 0.497R baseline from crypto-signal-validation.md
//   - liquidation rate
//   - return on margin per trade (the seductive side — this rises with L
//     even while the edge degrades, which is exactly the trap)
//
// Also reports Maximum Adverse Excursion (MAE): how deep winning trades dip
// against entry before they work. That distribution is what determines which
// leverage levels rob you of trades that would otherwise have won.

const { getDailyCandles } = require('../crypto/binance');
const { walkForwardOccurrences } = require('../stock/backtest');
const { atr } = require('../risk');
const { DEFAULT_VALIDATION_UNIVERSE } = require('../crypto/universe');

const CONFLUENCE_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming', 'bos-bullish'];
const HOLD_DAYS = 7;
const TARGET_R = 1.8;
const ATR_MULT = 1.5;
const LEVERAGES = [1, 2, 3, 5, 10, 15, 20, 30, 50, 75, 100];
// Exchanges liquidate slightly BEFORE margin is fully depleted (maintenance
// margin + liquidation fee). 0.95 is optimistic-but-realistic for majors.
const MAINTENANCE_FACTOR = 0.95;

// Collect the raw trade set once, so every leverage scenario replays the
// exact same historical setups.
function collectTrades(candles, symbol) {
  const occurrences = walkForwardOccurrences(candles);
  const dayCounts = new Map();
  for (const kind of CONFLUENCE_KINDS) {
    for (const hit of occurrences[kind] || []) {
      dayCounts.set(hit.index, (dayCounts.get(hit.index) || 0) + 1);
    }
  }

  const trades = [];
  for (const hit of occurrences['cup-forming'] || []) {
    if ((dayCounts.get(hit.index) || 0) < 2) continue;
    const i = hit.index;
    if (i + 1 >= candles.length) continue;
    const entry = candles[i].close;
    const a = atr(candles.slice(0, i + 1), 14);
    if (!(a > 0) || !(entry > 0)) continue;
    const stopDistance = a * ATR_MULT;
    const path = candles.slice(i + 1, i + 1 + HOLD_DAYS);
    if (!path.length) continue;
    trades.push({ symbol, entry, stopDistance, stopPct: stopDistance / entry, path });
  }
  return trades;
}

// Replay one trade with an effective stop = whichever is hit first,
// liquidation or the intended stop. Returns outcome in ORIGINAL R units.
function simulateAtLeverage(trade, leverage) {
  const { entry, stopDistance, stopPct, path } = trade;
  const liqPct = leverage > 1 ? (MAINTENANCE_FACTOR / leverage) : Infinity;
  const liqPrice = leverage > 1 ? entry * (1 - liqPct) : -Infinity;
  const stopPrice = entry - stopDistance;
  const targetPrice = entry + stopDistance * TARGET_R;
  // Liquidation only bites when it sits INSIDE the intended stop.
  const effectiveStopPrice = Math.max(stopPrice, liqPrice);
  const liquidated = liqPrice > stopPrice;

  let maeR = 0;
  for (const bar of path) {
    const adverseR = (entry - bar.low) / stopDistance;
    if (adverseR > maeR) maeR = adverseR;
    // Conservative ordering: assume the adverse level is touched before the
    // favorable one within the same daily bar.
    if (bar.low <= effectiveStopPrice) {
      const lossR = (entry - effectiveStopPrice) / stopDistance;
      return { r: -lossR, maeR, wasLiquidated: liquidated, resolved: 'stop' };
    }
    if (bar.high >= targetPrice) return { r: TARGET_R, maeR, wasLiquidated: false, resolved: 'target' };
  }
  const exit = path[path.length - 1].close;
  return { r: (exit - entry) / stopDistance, maeR, wasLiquidated: false, resolved: 'timeout' };
}

function pct(n, d) {
  return d ? Math.round((n / d) * 1000) / 10 : null;
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[idx];
}

async function run({ log = console.log } = {}) {
  const allTrades = [];
  const stopPctBySymbol = {};
  for (const symbol of DEFAULT_VALIDATION_UNIVERSE) {
    let candles;
    try {
      candles = await getDailyCandles(symbol, 730);
    } catch (err) {
      log(`[leverageRisk] skip ${symbol}: ${err.message}`);
      continue;
    }
    if (!candles || candles.length < 100) continue;
    const trades = collectTrades(candles, symbol);
    allTrades.push(...trades);
    // Typical stop width per symbol — this is what caps safe leverage.
    const recent = candles.slice(-60);
    const a = atr(candles, 14);
    stopPctBySymbol[symbol] = {
      trades: trades.length,
      stopPctNow: a ? Math.round((a * ATR_MULT / recent[recent.length - 1].close) * 10000) / 100 : null,
      stopPctMedianAtSignal: trades.length
        ? Math.round(quantile(trades.map((t) => t.stopPct).sort((x, y) => x - y), 0.5) * 10000) / 100
        : null,
    };
  }

  // MAE distribution at baseline (no leverage interference)
  const baseline = allTrades.map((t) => simulateAtLeverage(t, 1));
  const winners = baseline.filter((o) => o.r > 0);
  const winnerMae = winners.map((o) => o.maeR).sort((a, b) => a - b);

  const byLeverage = LEVERAGES.map((L) => {
    const outcomes = allTrades.map((t) => simulateAtLeverage(t, L));
    const rs = outcomes.map((o) => o.r);
    const liqs = outcomes.filter((o) => o.wasLiquidated).length;
    const avgR = mean(rs);
    // Return on margin: 1R of price move = stopPct of notional; margin is
    // notional/L, so 1R = stopPct*L in margin terms.
    const avgStopPct = mean(allTrades.map((t) => t.stopPct));
    return {
      leverage: L,
      avgR: Math.round(avgR * 1000) / 1000,
      winRate: pct(rs.filter((r) => r > 0).length, rs.length),
      liquidationRate: pct(liqs, outcomes.length),
      returnOnMarginPercent: Math.round(avgR * avgStopPct * L * 1000) / 10,
    };
  });

  return { allTrades, stopPctBySymbol, winnerMae, byLeverage, baselineTrades: allTrades.length };
}

if (require.main === module) {
  run().then(({ stopPctBySymbol, winnerMae, byLeverage, baselineTrades }) => {
    console.log(`\n=== Stop width per pair (ATR*1.5 as % of price) ===`);
    console.log(`Max leverage before liquidation sits INSIDE the stop = ~1/stopPct\n`);
    for (const [symbol, s] of Object.entries(stopPctBySymbol)) {
      const maxLev = s.stopPctMedianAtSignal ? (95 / s.stopPctMedianAtSignal).toFixed(1) : '-';
      console.log(
        `${symbol.padEnd(11)} stop now ${String(s.stopPctNow ?? '-').padStart(5)}%  ` +
        `median at signal ${String(s.stopPctMedianAtSignal ?? '-').padStart(5)}%  ` +
        `=> liq-at-stop leverage ${String(maxLev).padStart(5)}x  (n=${s.trades})`,
      );
    }

    console.log(`\n=== MAE of WINNING trades (how deep they dip before working) ===`);
    console.log(`n winners = ${winnerMae.length}`);
    for (const q of [0.25, 0.5, 0.75, 0.9, 0.95]) {
      console.log(`  p${String(q * 100).padStart(2)}: ${quantile(winnerMae, q)?.toFixed(3)} R`);
    }

    console.log(`\n=== Same ${baselineTrades} trades, replayed at each leverage ===`);
    console.log(`avgR is in ORIGINAL R units (1R = ATR*1.5), comparable to the 0.497R baseline.\n`);
    console.log('lev'.padStart(4), 'avgR'.padStart(8), 'winRate'.padStart(9), 'liq%'.padStart(7), 'ret/margin'.padStart(11));
    for (const row of byLeverage) {
      console.log(
        String(row.leverage + 'x').padStart(4),
        String(row.avgR).padStart(8),
        String(row.winRate + '%').padStart(9),
        String(row.liquidationRate + '%').padStart(7),
        String(row.returnOnMarginPercent + '%').padStart(11),
      );
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run, collectTrades, simulateAtLeverage };
