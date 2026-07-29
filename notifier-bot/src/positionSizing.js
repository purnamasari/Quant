// Position sizing for leveraged perp trades.
//
// The central idea, and the thing that makes leverage survivable: leverage is
// an OUTPUT, never an input. You choose how much of the account to risk; the
// stop distance then determines the position's notional; leverage is only how
// much margin you post to control that notional. Sizing by "I'll use 50x"
// inverts this and is what blows accounts up.
//
// Empirical basis (src/analysis/leverageRisk.js, replaying all 118 historical
// cup-forming+confluence trades at each leverage, avgR in original R units):
//
//     1-5x   0.497R   0% liquidated    <- edge fully intact
//     10x    0.495R   4.2% liquidated
//     15x    0.463R  12.7% liquidated
//     20x    0.439R  18.6% liquidated
//     30x    0.304R    50% liquidated  <- edge nearly halved
//     50x    0.133R  71.2% liquidated
//     100x   0.096R  83.1% liquidated  <- edge destroyed
//
// The mechanism is not "bigger losses". At leverage L the exchange liquidates
// at ~(1/L) adverse move; when that lands INSIDE the ATR*1.5 stop, liquidation
// silently replaces the stop the edge was measured with, and ordinary noise
// closes trades that would have won. MAE data shows winning trades dip a
// median 0.263R and a p95 of 0.837R before working — they need that room.
//
// Hence LIQUIDATION_BUFFER: margin is sized so liquidation sits at least 2x
// the stop distance away, keeping the real stop in control of every exit.

const config = require('./config');

// Liquidation must sit at least this multiple of the stop distance away.
const LIQUIDATION_BUFFER = 2.0;
// Exchanges liquidate slightly before margin is fully gone (maintenance
// margin + liquidation fee); assume 95% of posted margin is usable.
const MAINTENANCE_FACTOR = 0.95;
// Hard ceiling regardless of how tight the stop is. Even where the math
// permits more, 20x already costs 12% of the edge and liquidates ~19% of
// trades, and that is measured on a benign 2-year sample.
const MAX_LEVERAGE_HARD_CAP = 15;
const FUNDING_SETTLEMENTS_PER_HOLD = 21; // 3/day * 7-day hold
// Funding above this fraction of 1R over the hold is a meaningful tax on a
// 0.497R edge — worth surfacing rather than silently paying.
const FUNDING_WARN_R = 0.15;

function round(v, digits = 2) {
  const s = 10 ** digits;
  return Math.round(v * s) / s;
}

// stopDistancePercent comes straight from riskPlanFor() — the ATR*1.5 stop
// expressed as a percentage of entry, which is exactly 1R in price terms.
function positionPlan({
  stopDistancePercent,
  entry,
  accountSize = config.accountSize,
  riskPercent = config.riskPercent,
  fundingRate = null,
  leverageCap = MAX_LEVERAGE_HARD_CAP,
} = {}) {
  if (!(stopDistancePercent > 0)) return null;
  const stopFraction = stopDistancePercent / 100;

  // Highest leverage that still keeps liquidation LIQUIDATION_BUFFER x the
  // stop distance away — i.e. the stop, not the exchange, ends the trade.
  const maxSafeLeverage = MAINTENANCE_FACTOR / (stopFraction * LIQUIDATION_BUFFER);
  const suggestedLeverage = Math.max(1, Math.min(leverageCap, Math.floor(maxSafeLeverage)));

  // Where the exchange would actually liquidate at the suggested leverage.
  const liquidationMovePercent = (MAINTENANCE_FACTOR / suggestedLeverage) * 100;

  const plan = {
    stopDistancePercent: round(stopDistancePercent),
    maxSafeLeverage: round(maxSafeLeverage, 1),
    suggestedLeverage,
    liquidationMovePercent: round(liquidationMovePercent),
    liquidationVsStop: round(liquidationMovePercent / stopDistancePercent, 2),
    liquidationPrice: entry ? round(entry * (1 - liquidationMovePercent / 100), 6) : null,
    warnings: [],
  };

  if (accountSize > 0 && riskPercent > 0) {
    const riskAmount = accountSize * (riskPercent / 100);
    const notional = riskAmount / stopFraction;
    const margin = notional / suggestedLeverage;
    plan.riskAmount = round(riskAmount);
    plan.notional = round(notional);
    plan.margin = round(margin);
    plan.marginPercentOfAccount = round((margin / accountSize) * 100);
    plan.quantity = entry ? round(notional / entry, 6) : null;
  } else {
    // No account size configured — still useful as a ratio.
    plan.notionalPerUnitRisk = round(1 / stopFraction, 1);
  }

  if (Number.isFinite(fundingRate)) {
    const holdCostPercent = fundingRate * FUNDING_SETTLEMENTS_PER_HOLD * 100;
    const holdCostR = holdCostPercent / stopDistancePercent;
    plan.fundingHoldCostPercent = round(holdCostPercent, 3);
    plan.fundingHoldCostR = round(holdCostR, 3);
    if (holdCostR > FUNDING_WARN_R) {
      plan.warnings.push(
        `Funding ${round(holdCostPercent, 2)}% over a 7-day hold = ${round(holdCostR, 2)}R — ` +
        `eats ${round((holdCostR / 0.497) * 100)}% of this setup's 0.497R edge. Consider a shorter hold or skipping.`,
      );
    }
  }

  if (maxSafeLeverage < 3) {
    plan.warnings.push(
      `Stop is ${round(stopDistancePercent)}% wide — even ${plan.suggestedLeverage}x leaves little room. ` +
      'This pair is unusually volatile right now; size down rather than lever up.',
    );
  }

  return plan;
}

module.exports = {
  positionPlan,
  LIQUIDATION_BUFFER,
  MAX_LEVERAGE_HARD_CAP,
  MAINTENANCE_FACTOR,
};
