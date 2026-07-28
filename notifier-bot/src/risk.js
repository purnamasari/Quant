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

function riskPlanFor(candles, { atrStopMultiplier = 1.5, minimumRewardRisk = 1.8 } = {}) {
  const latest = candles[candles.length - 1];
  const a = atr(candles, 14) ?? latest.close * 0.02;
  const stop = latest.close - a * atrStopMultiplier;
  const target = latest.close + a * atrStopMultiplier * minimumRewardRisk;
  const riskPerUnit = latest.close - stop;
  const rewardPerUnit = target - latest.close;
  return {
    entry: round(latest.close),
    stop: round(stop),
    target: round(target),
    rewardRisk: riskPerUnit > 0 ? round(rewardPerUnit / riskPerUnit) : null,
    stopDistancePercent: round((riskPerUnit / latest.close) * 100),
  };
}

function round(v, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(v * scale) / scale;
}

module.exports = { atr, riskPlanFor };
