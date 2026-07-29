// Lightweight ATR-based risk plan, mirroring the stop/target math used in
// purnamasari/quant's runBacktest (src/shared/quant.ts): stop = close - ATR*1.5,
// target = close + ATR*minimumRewardRisk*1.5. This is NOT the full
// RiskRewardPlan from quant.ts (no pivot-based support/resistance), just
// enough to make the Telegram alert directly actionable.

function atr(candles, length = 14) {
  if (candles.length < length + 1) return null;
  const ranges = [];
  for (let i = candles.length - length; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    ranges.push(Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
  }
  return ranges.reduce((a, b) => a + b, 0) / ranges.length;
}

// EXIT RULE, revised after measurement (src/analysis/trailingExitTest.js):
// the fixed 1.8R target was costing roughly half the edge. Same entries, only
// the exit varied, 118 trades on the validated universe, cost-adjusted:
//
//   ATR*1.5 stop + 1.8R target, 7-day hold   0.453R  (t 4.68)  <- what we had
//   ATR*1.5 stop + 1.8R target, 14-day hold  0.709R  (t 6.24)
//   ATR*1.5 stop, NO target, 14-day hold     0.949R  (t 5.49)  <- best
//   Parabolic SAR trailing stop, 14-day cap  0.876R  (t 5.36)
//
// Two things that are easy to get backwards, both tested rather than assumed:
// a trailing stop is WORSE than simply removing the target (it re-introduces
// an early exit), and most of the gain comes from letting the trade run rather
// than from any cleverness in how it is closed.
//
// Confirmed against the controls that matter: random entries over the same
// pairs and period return 0.003R (t 0.10, n 2360), so this is not bull-market
// drift; and the effect survives out-of-universe on 18 mid-caps (0.588R,
// t 2.63) where the fixed-target version measured only 0.046R.
//
// `target` is therefore no longer an exit instruction. It is kept as a
// reference level for sizing and for the chart, because a plan with no number
// on the upside is hard to act on — but the rule is stop or time, not target.
function riskPlanFor(candles, { atrStopMultiplier = 1.5, minimumRewardRisk = 1.8, entryOverride = null } = {}) {
  const latest = candles[candles.length - 1];
  const entry = entryOverride ?? latest.close;
  const a = atr(candles, 14) ?? latest.close * 0.02;
  const stop = entry - a * atrStopMultiplier;
  const target = entry + a * atrStopMultiplier * minimumRewardRisk;
  const riskPerUnit = entry - stop;
  const rewardPerUnit = target - entry;
  return {
    entry: round(entry),
    stop: round(stop),
    target: round(target),
    rewardRisk: riskPerUnit > 0 ? round(rewardPerUnit / riskPerUnit) : null,
    stopDistancePercent: round((riskPerUnit / entry) * 100),
    // The validated exit: hold until the stop is hit or this many days pass.
    holdDays: VALIDATED_HOLD_DAYS,
  };
}

// 14 days measured best (0.949R). 21 days was worse (0.823R), so this is a
// plateau rather than "longer is always better" — do not raise it without
// re-running the test.
const VALIDATED_HOLD_DAYS = 14;

function round(v, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(v * scale) / scale;
}

module.exports = { atr, riskPlanFor };
