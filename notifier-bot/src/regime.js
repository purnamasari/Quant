// Market regime classification (bull / bear / sideways), used both by the
// regime-split backtest and by the live scan.
//
// Regime is taken from BTC, not from each symbol. Two reasons: alt correlation
// to BTC runs 0.7-0.9 (already documented in data/risk-management-plan.md as
// the reason maxConcurrentPositions exists), so a per-symbol regime would be
// mostly the same variable measured 12 times with more noise; and a per-symbol
// regime gives every strategy its own private definition of "bull", which is a
// free parameter per symbol and an easy way to fit noise.
//
// The classifier is deliberately boring — 200-day SMA position plus its slope.
// Anything with more knobs (volatility bands, ADX thresholds, drawdown depth)
// would need its own validation before it could be trusted to gate alerts, and
// the whole point here is to test whether regime matters at all, not to find
// the best possible regime detector.
//
// NO LOOK-AHEAD: classifyAt(candles, i) reads candles[0..i] only. The SMA slope
// compares the SMA at i against the SMA 20 bars earlier, both computed from
// closed candles at or before i.

const SMA_LENGTH = 200;
const SLOPE_LOOKBACK = 20;
// A flat market still wobbles; requiring the 200SMA to have moved more than
// this over 20 bars keeps small drift from being read as a trend.
const SLOPE_FLAT_THRESHOLD = 0.02; // 2% over 20 bars

function sma(candles, endIndex, length) {
  if (endIndex + 1 < length) return null;
  let sum = 0;
  for (let i = endIndex - length + 1; i <= endIndex; i++) sum += candles[i].close;
  return sum / length;
}

// Returns 'bull' | 'bear' | 'sideways' | null (null = not enough history).
function classifyAt(candles, i) {
  const now = sma(candles, i, SMA_LENGTH);
  const then = sma(candles, i - SLOPE_LOOKBACK, SMA_LENGTH);
  if (now === null || then === null) return null;

  const above = candles[i].close > now;
  const slope = (now - then) / then;

  if (above && slope > SLOPE_FLAT_THRESHOLD) return 'bull';
  if (!above && slope < -SLOPE_FLAT_THRESHOLD) return 'bear';
  return 'sideways';
}

function classifyLatest(candles) {
  return classifyAt(candles, candles.length - 1);
}

const REGIME_LABEL = { bull: 'BULL', bear: 'BEAR', sideways: 'SIDEWAYS' };
const REGIME_EMOJI = { bull: '📈', bear: '📉', sideways: '↔️' };

module.exports = {
  classifyAt,
  classifyLatest,
  REGIME_LABEL,
  REGIME_EMOJI,
  SMA_LENGTH,
  SLOPE_LOOKBACK,
  SLOPE_FLAT_THRESHOLD,
};
