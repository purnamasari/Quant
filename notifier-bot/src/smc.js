// Faithful port of the Order Block / Fair Value Gap / Break of Structure
// detection logic from "Super OrderBlock / FVG / BoS Tools by makuchaku &
// eFe" (Pine Script v5, TradingView, MPL-2.0), pasted in full by the user.
// This ports the exact boolean conditions, not a generic
// reinterpretation — see each function's comment for the corresponding
// Pine expression. Rejection Blocks (RJB) and PPDD liquidity-sweep OB
// variants from the original script are NOT ported (more parameters,
// lower priority for a first validation pass) — only OB, FVG, and BoS
// with default settings (pivotLookup=1).
//
// Candle shape: { time, open, high, low, close, volume }. All detectors
// take the FULL trailing window ending at "now" (same convention as
// stock/signals.js) and report whether the pattern is confirmed as of the
// last candle in that window.

function isUp(c) {
  return c.close > c.open;
}
function isDown(c) {
  return c.close < c.open;
}

// Pine: isObUp(index) => isDown(index+1) and isUp(index) and close[index] > high[index+1]
// Pine: isObDown(index) => isUp(index+1) and isDown(index) and close[index] < low[index+1]
// Evaluated with index=1 (i.e. relative to the second-to-last candle),
// confirmed as of the last candle in the window — same lag convention the
// original script draws its box with (box right edge = current bar_index).
function detectOB(clean) {
  const n = clean.length;
  if (n < 3) return null;
  const b = clean[n - 3]; // Pine's index+1 = 2 bars back
  const a = clean[n - 2]; // Pine's index = 1 bar back
  if (isDown(b) && isUp(a) && a.close > b.high) {
    return { kind: 'ob-bullish', direction: 'long', top: b.high, bottom: Math.min(b.low, a.low) };
  }
  if (isUp(b) && isDown(a) && a.close < b.low) {
    return { kind: 'ob-bearish', direction: 'short', top: Math.max(b.high, a.high), bottom: b.low };
  }
  return null;
}

// Pine: isFvgUp(0) => low[0] > high[2]   (3-candle gap, current vs 2 back)
// Pine: isFvgDown(0) => high[0] < low[2]
function detectFVG(clean) {
  const n = clean.length;
  if (n < 3) return null;
  const cur = clean[n - 1];
  const twoBack = clean[n - 3];
  if (cur.low > twoBack.high) return { kind: 'fvg-bullish', direction: 'long', top: cur.low, bottom: twoBack.high };
  if (cur.high < twoBack.low) return { kind: 'fvg-bearish', direction: 'short', top: twoBack.low, bottom: cur.high };
  return null;
}

// Pine: hih = ta.pivothigh(high, pivotLookup, pivotLookup); top = valuewhen(hih, high[pivotLookup], 0)
//       lol = ta.pivotlow(low, pivotLookup, pivotLookup); bottom = valuewhen(lol, low[pivotLookup], 0)
//       bullish BoS: ta.crossover(close, top) — bearish: ta.crossunder(close, bottom)
// pivotLookup default = 1 (simplest 3-bar fractal: candle's high/low is a
// local extreme vs its immediate neighbor on each side).
function findLastConfirmedPivot(candles, type, lookback = 1) {
  for (let p = candles.length - 1 - lookback; p >= lookback; p--) {
    let isPivot = true;
    for (let k = 1; k <= lookback && isPivot; k++) {
      if (type === 'high') {
        if (!(candles[p].high > candles[p - k].high && candles[p].high > candles[p + k].high)) isPivot = false;
      } else if (!(candles[p].low < candles[p - k].low && candles[p].low < candles[p + k].low)) {
        isPivot = false;
      }
    }
    if (isPivot) return { index: p, price: type === 'high' ? candles[p].high : candles[p].low };
  }
  return null;
}

function detectBoS(clean, lookback = 1) {
  const n = clean.length;
  if (n < lookback * 2 + 3) return null;

  const topNow = findLastConfirmedPivot(clean, 'high', lookback);
  const bottomNow = findLastConfirmedPivot(clean, 'low', lookback);
  const prevSlice = clean.slice(0, n - 1);
  const topPrev = findLastConfirmedPivot(prevSlice, 'high', lookback);
  const bottomPrev = findLastConfirmedPivot(prevSlice, 'low', lookback);

  const closeNow = clean[n - 1].close;
  const closePrev = clean[n - 2].close;

  if (topNow && topPrev && closePrev <= topPrev.price && closeNow > topNow.price) {
    return { kind: 'bos-bullish', direction: 'long', level: topNow.price };
  }
  if (bottomNow && bottomPrev && closePrev >= bottomPrev.price && closeNow < bottomNow.price) {
    return { kind: 'bos-bearish', direction: 'short', level: bottomNow.price };
  }
  return null;
}

module.exports = { detectOB, detectFVG, detectBoS, findLastConfirmedPivot };
