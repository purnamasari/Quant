// Bullish half ported from purnamasari/quant `src/shared/signals.ts`
// (detectStockSignals) — same math, stripped of TypeScript types. Bearish
// mirror signals added on top (death-cross, ma-breakdown, macd-bearish,
// volume-surge-down, momentum-laggard, mean-reversion-short, near/new-52w-low,
// rebound-down/rejection, distribution) since the original app was
// long-only. Every signal now carries `direction: 'long' | 'short'`.
// Candle shape: { time, open, high, low, close, volume }.

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function last(items) {
  return items.length ? items[items.length - 1] : null;
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sma(values, length, end = values.length) {
  if (end < length) return null;
  return mean(values.slice(end - length, end));
}

function ema(values, length) {
  if (!values.length) return [];
  const k = 2 / (length + 1);
  const out = [values[0]];
  for (let i = 1; i < values.length; i++) out.push(values[i] * k + out[i - 1] * (1 - k));
  return out;
}

function pctChange(from, to) {
  if (!finite(from) || !finite(to) || from === 0) return null;
  return ((to - from) / from) * 100;
}

function rangeWidth(candles) {
  if (!candles.length) return null;
  const high = Math.max(...candles.map((c) => c.high));
  const low = Math.min(...candles.map((c) => c.low));
  const close = last(candles)?.close ?? 0;
  if (close <= 0) return null;
  return ((high - low) / close) * 100;
}

function push(signals, kind, label, score, detail, tone = 'bullish', direction = 'long') {
  signals.push({ kind, label, score, detail, tone, direction });
}

const { detectOB, detectFVG, detectBoS } = require('../smc');

function buildSignalMetrics(candles) {
  const current = last(candles);
  const previous = candles.length > 1 ? candles[candles.length - 2] : null;
  const closes = candles.map((c) => c.close);
  const lastClose = current?.close ?? 0;
  const high252 = candles.length ? Math.max(...candles.slice(-252).map((c) => c.high)) : null;
  const low252 = candles.length ? Math.min(...candles.slice(-252).map((c) => c.low)) : null;
  const avgVolume20 = mean(candles.slice(-21, -1).map((c) => c.volume));
  return {
    lastClose,
    previousClose: previous?.close ?? null,
    changePercent: previous ? pctChange(previous.close, lastClose) : null,
    return21: closes.length > 21 ? pctChange(closes[closes.length - 22], lastClose) : null,
    return63: closes.length > 63 ? pctChange(closes[closes.length - 64], lastClose) : null,
    return126: closes.length > 126 ? pctChange(closes[closes.length - 127], lastClose) : null,
    high252,
    low252,
    distanceToHighPercent: high252 && high252 > 0 ? round(((high252 - lastClose) / high252) * 100, 2) : null,
    distanceToLowPercent: low252 && low252 > 0 ? round(((lastClose - low252) / low252) * 100, 2) : null,
    volumeRatio20: avgVolume20 && avgVolume20 > 0 && current ? round(current.volume / avgVolume20, 2) : null,
  };
}

function detectStockSignals(candles) {
  const clean = candles.filter((c) => c.close > 0).slice(-252);
  const metrics = buildSignalMetrics(clean);
  const signals = [];
  if (clean.length < 50) return { signals, metrics };

  const closes = clean.map((c) => c.close);
  const latest = clean[clean.length - 1];
  const prev = clean[clean.length - 2];
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const ma120 = sma(closes, Math.min(120, Math.max(50, Math.floor(clean.length * 0.55))));
  const ma20Prev = sma(closes, 20, closes.length - 8);
  const ma50Prev = sma(closes, 50, closes.length - 8);

  // --- Bullish (long) ---

  if (
    ma20 && ma50 && ma120 &&
    latest.close > ma20 && ma20 > ma50 && ma50 > ma120 &&
    (!ma20Prev || ma20 >= ma20Prev) &&
    (!ma50Prev || ma50 >= ma50Prev)
  ) {
    push(signals, 'ma-alignment', 'MA alignment', 18, 'Close > MA20 > MA50 > long MA, with rising short/medium averages.');
  }

  if (metrics.high252 && latest.close >= metrics.high252 * 0.995) {
    push(signals, 'new-52w-high', '52W high', 17, 'Latest close is effectively at a one-year high.');
  } else if (metrics.distanceToHighPercent !== null && metrics.distanceToHighPercent <= 4) {
    push(signals, 'near-52w-high', 'Near 52W high', 12, `Within ${metrics.distanceToHighPercent}% of the one-year high.`);
  }

  if (metrics.volumeRatio20 !== null && metrics.volumeRatio20 >= 1.75 && prev && latest.close > prev.close) {
    push(signals, 'volume-surge', 'Volume surge', 13, `Volume is ${metrics.volumeRatio20}x the 20-day average on an up close.`, 'hot');
  }

  if (clean.length >= 140) {
    const longMa = 120;
    const ma50Now = sma(closes, 50);
    const maLongNow = sma(closes, longMa);
    const ma50Was = sma(closes, 50, closes.length - 8);
    const maLongWas = sma(closes, longMa, closes.length - 8);
    if (ma50Now && maLongNow && ma50Was && maLongWas && ma50Was <= maLongWas && ma50Now > maLongNow) {
      push(signals, 'golden-cross', 'Golden cross', 14, 'MA50 crossed above the long moving average recently.');
    }
    if (ma50Now && maLongNow && ma50Was && maLongWas && ma50Was >= maLongWas && ma50Now < maLongNow) {
      push(signals, 'death-cross', 'Death cross', 14, 'MA50 crossed below the long moving average recently.', 'bearish', 'short');
    }
  }

  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = ema12.map((v, i) => v - (ema26[i] ?? v));
  const macdSignal = ema(macd, 9);
  const macdNow = last(macd);
  const signalNow = last(macdSignal);
  const macdPrev = macd.length > 5 ? macd[macd.length - 6] : null;
  const signalPrev = macdSignal.length > 5 ? macdSignal[macdSignal.length - 6] : null;
  if (
    finite(macdNow) && finite(signalNow) && macdNow > signalNow &&
    (!finite(macdPrev) || !finite(signalPrev) || macdPrev <= signalPrev || macdNow > macdPrev)
  ) {
    push(signals, 'macd-bullish', 'MACD bullish', 8, 'MACD is above signal and improving.');
  }
  if (
    finite(macdNow) && finite(signalNow) && macdNow < signalNow &&
    (!finite(macdPrev) || !finite(signalPrev) || macdPrev >= signalPrev || macdNow < macdPrev)
  ) {
    push(signals, 'macd-bearish', 'MACD bearish', 8, 'MACD is below signal and deteriorating.', 'bearish', 'short');
  }

  const recent15 = clean.slice(-15);
  const prior30 = clean.slice(-45, -15);
  const prior60 = clean.slice(-105, -45);
  const w15 = rangeWidth(recent15);
  const w30 = rangeWidth(prior30);
  const w60 = rangeWidth(prior60);
  const recentHigh = Math.max(...recent15.map((c) => c.high));
  const volumeDry = metrics.volumeRatio20 !== null && metrics.volumeRatio20 <= 0.95;
  if (
    w15 !== null && w30 !== null && w60 !== null &&
    w15 < w30 * 0.82 && w30 < w60 * 0.92 &&
    recentHigh > 0 && latest.close >= recentHigh * 0.94
  ) {
    push(
      signals, 'vcp', 'VCP forming',
      volumeDry ? 16 : 12,
      volumeDry
        ? 'Volatility is contracting and volume is drying up near the recent high.'
        : 'Volatility is contracting near the recent high.',
      'watch',
    );
  }

  if (clean.length >= 110) {
    const window = clean.slice(-150);
    const first = window.slice(0, Math.floor(window.length * 0.35));
    const middle = window.slice(Math.floor(window.length * 0.25), Math.floor(window.length * 0.78));
    const lastPart = window.slice(Math.floor(window.length * 0.62));

    // Cup forming / handle (long)
    const leftHigh = Math.max(...first.map((c) => c.high));
    const bottom = Math.min(...middle.map((c) => c.low));
    const rightHigh = Math.max(...lastPart.map((c) => c.high));
    const depth = leftHigh > 0 ? ((leftHigh - bottom) / leftHigh) * 100 : 0;
    const recovery = leftHigh > bottom ? ((latest.close - bottom) / (leftHigh - bottom)) * 100 : 0;
    const nearRim = leftHigh > 0 && Math.abs(latest.close - leftHigh) / leftHigh <= 0.09;
    const handleRange = rangeWidth(clean.slice(-18));
    if (depth >= 12 && depth <= 38 && recovery >= 65 && nearRim && rightHigh >= leftHigh * 0.88) {
      push(signals, 'cup-forming', 'Cup forming', 16, `Rounded base depth is about ${round(depth, 1)}% and price has recovered near the left rim.`, 'watch');
      if (handleRange !== null && handleRange <= 8 && latest.close >= leftHigh * 0.9) {
        push(signals, 'cup-handle', 'Cup handle', 18, 'A shallow handle is forming near the cup rim.', 'hot');
      }
    }

    // Distribution / rounded top (short) — mirror of cup-forming
    const leftLow = Math.min(...first.map((c) => c.low));
    const top = Math.max(...middle.map((c) => c.high));
    const rightLow = Math.min(...lastPart.map((c) => c.low));
    const riseHeight = leftLow > 0 ? ((top - leftLow) / leftLow) * 100 : 0;
    const giveback = top > rightLow ? ((top - latest.close) / (top - rightLow || 1)) * 100 : 0;
    const nearFloor = leftLow > 0 && Math.abs(latest.close - leftLow) / leftLow <= 0.09;
    if (riseHeight >= 12 && riseHeight <= 38 && giveback >= 65 && nearFloor && rightLow <= leftLow * 1.12) {
      push(signals, 'distribution', 'Distribution top', 16, `Rounded top gave back about ${round(riseHeight, 1)}% and price has fallen back near the left floor.`, 'watch', 'short');
    }
  }

  if (ma20 && ma50 && prev && latest.low <= ma20 * 1.01 && latest.close > ma20 && latest.close > prev.close && latest.close > latest.open) {
    push(signals, 'rebound', 'MA rebound', 9, 'Price reclaimed the 20-day average after testing it.', 'watch');
  } else if (ma50 && prev && latest.low <= ma50 * 1.015 && latest.close > ma50 && latest.close > prev.close) {
    push(signals, 'rebound', 'MA50 rebound', 9, 'Price bounced from the 50-day moving average.', 'watch');
  }

  // Rejection at MA (short) — mirror of rebound
  if (ma20 && ma50 && prev && latest.high >= ma20 * 0.99 && latest.close < ma20 && latest.close < prev.close && latest.close < latest.open) {
    push(signals, 'rebound-down', 'MA rejection', 9, 'Price was rejected at the 20-day average after testing it from below.', 'watch', 'short');
  } else if (ma50 && prev && latest.high >= ma50 * 0.985 && latest.close < ma50 && latest.close < prev.close) {
    push(signals, 'rebound-down', 'MA50 rejection', 9, 'Price was rejected from the 50-day moving average.', 'watch', 'short');
  }

  const last50 = closes.slice(-50);
  const avg50 = mean(last50);
  if (avg50 && last50.length >= 30) {
    const variance = mean(last50.map((v) => (v - avg50) ** 2)) ?? 0;
    const sigma = Math.sqrt(variance);
    if (sigma > 0 && latest.close < avg50 - sigma * 1.8 && latest.close > latest.open) {
      push(signals, 'mean-reversion', 'Mean reversion', 7, 'Price is stretched below the 50-day mean but closed positive.', 'watch');
    }
    if (sigma > 0 && latest.close > avg50 + sigma * 1.8 && latest.close < latest.open) {
      push(signals, 'mean-reversion-short', 'Mean reversion (fade)', 7, 'Price is stretched above the 50-day mean but closed negative.', 'watch', 'short');
    }
  }

  if ((metrics.return63 ?? 0) >= 12 && (metrics.return126 ?? 0) >= 18) {
    push(signals, 'momentum', 'Momentum leader', 10, 'Three- and six-month price performance are both strong.');
  }
  if ((metrics.return63 ?? 0) <= -12 && (metrics.return126 ?? 0) <= -18) {
    push(signals, 'momentum-laggard', 'Momentum laggard', 10, 'Three- and six-month price performance are both weak.', 'bearish', 'short');
  }

  if (metrics.low252 && latest.close <= metrics.low252 * 1.005) {
    push(signals, 'new-52w-low', '52W low', 17, 'Latest close is effectively at a one-year low.', 'bearish', 'short');
  } else if (metrics.distanceToLowPercent !== null && metrics.distanceToLowPercent <= 4) {
    push(signals, 'near-52w-low', 'Near 52W low', 12, `Within ${metrics.distanceToLowPercent}% of the one-year low.`, 'bearish', 'short');
  }

  if (metrics.volumeRatio20 !== null && metrics.volumeRatio20 >= 1.75 && prev && latest.close < prev.close) {
    push(signals, 'volume-surge-down', 'Volume surge (down)', 13, `Volume is ${metrics.volumeRatio20}x the 20-day average on a down close.`, 'hot', 'short');
  }

  // --- SMC: Order Block / Fair Value Gap / Break of Structure ---
  // Ported from the TradingView Pine Script the user provided — see
  // src/smc.js for the exact mapping to the original conditions.
  const ob = detectOB(clean);
  if (ob) {
    push(
      signals, ob.kind, ob.kind === 'ob-bullish' ? 'Order Block (bullish)' : 'Order Block (bearish)', 12,
      `${ob.kind === 'ob-bullish' ? 'Bullish' : 'Bearish'} order block formed (zone ${round(ob.bottom)}-${round(ob.top)}).`,
      'watch', ob.direction,
    );
  }
  const fvg = detectFVG(clean);
  if (fvg) {
    push(
      signals, fvg.kind, fvg.kind === 'fvg-bullish' ? 'Fair Value Gap (bullish)' : 'Fair Value Gap (bearish)', 10,
      `${fvg.kind === 'fvg-bullish' ? 'Bullish' : 'Bearish'} FVG opened (gap ${round(fvg.bottom)}-${round(fvg.top)}).`,
      'watch', fvg.direction,
    );
  }
  const bos = detectBoS(clean);
  if (bos) {
    push(
      signals, bos.kind, bos.kind === 'bos-bullish' ? 'Break of Structure (bullish)' : 'Break of Structure (bearish)', 14,
      `Close ${bos.kind === 'bos-bullish' ? 'broke above' : 'broke below'} the last swing ${bos.kind === 'bos-bullish' ? 'high' : 'low'} at ${round(bos.level)}.`,
      'watch', bos.direction,
    );
  }

  const bestByKind = new Map();
  for (const signal of signals) {
    const prevSignal = bestByKind.get(signal.kind);
    if (!prevSignal || signal.score > prevSignal.score) bestByKind.set(signal.kind, signal);
  }

  return { signals: [...bestByKind.values()].sort((a, b) => b.score - a.score), metrics };
}

module.exports = { detectStockSignals, buildSignalMetrics, sma, ema, mean };
