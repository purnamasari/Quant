// Pure price-series analysis for the chart modal: pivot detection and
// trend-line projection. No DOM, no React, no I/O — unit-testable in
// isolation. All interpolation happens in candle-INDEX space (bar space),
// never epoch space, because trading sessions have gaps (nights, weekends)
// that would bend a "straight" line drawn against wall-clock time.

import type { Candle, PivotPoint } from '../../../shared/types';

/** One vertex of a projected trend line, ready for a line series. */
export interface TrendLinePoint {
  time: number; // unix seconds — matches the candle at this index
  value: number;
}

export interface TrendLines {
  /** Line through the two most recent pivot lows, projected to the last bar.
   *  Empty when fewer than two pivot lows exist. */
  support: TrendLinePoint[];
  /** Line through the two most recent pivot highs, projected to the last bar.
   *  Empty when fewer than two pivot highs exist. */
  resistance: TrendLinePoint[];
}

/** Neighbourhood half-width used for pivot detection: clamp(3, ceil(n/40), 12). */
export function pivotWindow(candleCount: number): number {
  return Math.min(12, Math.max(3, Math.ceil(candleCount / 40)));
}

/** True when candles[i] is the strict extreme of its ±k neighbourhood.
 *  Ties resolve to the FIRST candle of the run: an equal value earlier in the
 *  window disqualifies i, an equal value later does not. */
function isPivotAt(
  candles: Candle[],
  i: number,
  k: number,
  kind: 'high' | 'low',
): boolean {
  const value = kind === 'high' ? candles[i].high : candles[i].low;
  for (let j = i - k; j <= i + k; j++) {
    if (j === i) continue;
    const other = kind === 'high' ? candles[j].high : candles[j].low;
    if (kind === 'high' ? other > value : other < value) return false;
    if (other === value && j < i) return false; // tie — earlier candle wins
  }
  return true;
}

/** Prominence of a candidate pivot: distance of its price from the mean of
 *  the surrounding closes, in units of their standard deviation. */
function prominenceAt(
  candles: Candle[],
  i: number,
  k: number,
  price: number,
): number {
  let sum = 0;
  let count = 0;
  for (let j = i - k; j <= i + k; j++) {
    if (j === i) continue;
    sum += candles[j].close;
    count++;
  }
  if (count === 0) return 0;
  const mean = sum / count;
  let varSum = 0;
  for (let j = i - k; j <= i + k; j++) {
    if (j === i) continue;
    const d = candles[j].close - mean;
    varSum += d * d;
  }
  const stdev = Math.sqrt(varSum / count);
  // Flat surroundings with a real spike → very prominent; guard the division.
  return Math.abs(price - mean) / Math.max(stdev, 1e-8);
}

const MAX_PIVOTS = 8;

/** Detect significant swing highs/lows. A pivot high is a candle whose high is
 *  the strict maximum of its ±k neighbours (k = pivotWindow(n), ties → first);
 *  pivot lows likewise on lows. Candidates are ranked by prominence and the
 *  top ≤8 are returned sorted ascending by time. */
export function findPivots(candles: Candle[]): PivotPoint[] {
  const n = candles.length;
  const k = pivotWindow(n);
  if (n < 2 * k + 1) return [];

  const scored: { pivot: PivotPoint; prominence: number }[] = [];
  for (let i = k; i < n - k; i++) {
    if (isPivotAt(candles, i, k, 'high')) {
      const price = candles[i].high;
      scored.push({
        pivot: { time: candles[i].time, price, kind: 'high' },
        prominence: prominenceAt(candles, i, k, price),
      });
    }
    if (isPivotAt(candles, i, k, 'low')) {
      const price = candles[i].low;
      scored.push({
        pivot: { time: candles[i].time, price, kind: 'low' },
        prominence: prominenceAt(candles, i, k, price),
      });
    }
  }

  scored.sort((a, b) => b.prominence - a.prominence);
  return scored
    .slice(0, MAX_PIVOTS)
    .map((s) => s.pivot)
    .sort((a, b) => a.time - b.time || (a.kind === b.kind ? 0 : a.kind === 'low' ? -1 : 1));
}

/** Project a straight line through the two most recent pivots of one kind.
 *  Slope is computed per candle INDEX between the two anchor pivots, then one
 *  {time,value} point is emitted for every candle from the first anchor's
 *  index through the last candle — a straight ray in bar space. */
function projectLine(
  candles: Candle[],
  indexByTime: Map<number, number>,
  anchors: PivotPoint[],
): TrendLinePoint[] {
  if (anchors.length < 2) return [];
  const a = anchors[anchors.length - 2];
  const b = anchors[anchors.length - 1];
  const ia = indexByTime.get(a.time);
  const ib = indexByTime.get(b.time);
  if (ia === undefined || ib === undefined || ia === ib) return [];
  const slope = (b.price - a.price) / (ib - ia);
  const out: TrendLinePoint[] = [];
  for (let i = ia; i < candles.length; i++) {
    out.push({ time: candles[i].time, value: a.price + slope * (i - ia) });
  }
  return out;
}

/** Support through the two most recent pivot lows, resistance through the two
 *  most recent pivot highs. Either line is empty when it lacks two anchors.
 *  `pivots` must be sorted ascending by time (as findPivots returns). */
export function computeTrendLines(
  candles: Candle[],
  pivots: PivotPoint[],
): TrendLines {
  const indexByTime = new Map<number, number>();
  for (let i = 0; i < candles.length; i++) indexByTime.set(candles[i].time, i);
  return {
    support: projectLine(candles, indexByTime, pivots.filter((p) => p.kind === 'low')),
    resistance: projectLine(candles, indexByTime, pivots.filter((p) => p.kind === 'high')),
  };
}
