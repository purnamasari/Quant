// Premium / discount location — a faithful port of market-pulse's
// engine/smc/equilibrium.py (with the strength.py, structure.py and
// analysis.py pieces it depends on), from purnamasari/market-pulse.
//
// Why this one, out of that repo's 76 engine modules: it is the only piece of
// genuinely new information that is also PARAMETER-FREE. Its own docstring
// refuses to add a tolerance band — "a band is a tunable this layer ships
// none of" — which means it cannot be quietly overfitted by a parameter
// search, and that is exactly the property this project keeps discovering it
// needs. Everything notifier-bot already scores is momentum- or
// volume-shaped; where price sits inside its own dealing range is orthogonal
// to all of it.
//
// The idea: the dealing range runs from the most recent STRONG swing (the last
// level the market actually defended) to the most extreme opposite swing
// printed since. Its midpoint is equilibrium. Above it price is at a premium,
// below it at a discount. The SMC entry rule is that longs are bought at a
// discount.
//
// LOOK-AHEAD: a pivot at bar p needs bars p+1..p+k to confirm, and
// compute_pivots only scans [k, n-k), so the newest k bars can never produce a
// pivot. Slicing the candle array at the signal bar is therefore sufficient —
// there is no separate confirmation delay to subtract. The pivot window itself
// is derived from the length of the slice, not of the full series, which is
// what makes a bar-limited replay match a live read.

// analysis.py: pivot_window
function pivotWindow(candleCount) {
  return Math.min(12, Math.max(3, Math.ceil(candleCount / 40)));
}

// analysis.py: _is_pivot_at. The `other === value && j < i` rejection keeps the
// EARLIEST of equal extremes, which is what makes the output deterministic.
function isPivotAt(candles, i, k, kind) {
  const value = kind === 'high' ? candles[i].high : candles[i].low;
  for (let j = i - k; j <= i + k; j++) {
    if (j === i) continue;
    const other = kind === 'high' ? candles[j].high : candles[j].low;
    if (kind === 'high' ? other > value : other < value) return false;
    if (other === value && j < i) return false;
  }
  return true;
}

// analysis.py: compute_pivots. Sorted by time; a low sorts before a high at
// equal times.
function computePivots(candles) {
  const n = candles.length;
  const k = pivotWindow(n);
  if (n < 2 * k + 1) return [];
  const found = [];
  for (let i = k; i < n - k; i++) {
    if (isPivotAt(candles, i, k, 'high')) {
      found.push({ time: candles[i].time, price: candles[i].high, kind: 'high' });
    }
    if (isPivotAt(candles, i, k, 'low')) {
      found.push({ time: candles[i].time, price: candles[i].low, kind: 'low' });
    }
  }
  return found.sort((a, b) => (a.time - b.time) || ((a.kind === 'low' ? 0 : 1) - (b.kind === 'low' ? 0 : 1)));
}

// structure.py: to_alternating_swings. Consecutive same-kind pivots are one
// leg, not several — keep each run's extreme.
function toAlternatingSwings(pivots) {
  const legs = [];
  for (const pivot of pivots) {
    const current = legs.length ? legs[legs.length - 1] : null;
    if (current === null || current.kind !== pivot.kind) {
      legs.push(pivot);
      continue;
    }
    const extendsLeg = pivot.kind === 'high' ? pivot.price > current.price : pivot.price < current.price;
    if (extendsLeg) legs[legs.length - 1] = pivot;
  }
  return legs;
}

// strength.py: derive_swing_strength.
//   strong — the counter-leg trades strictly beyond the preceding opposite swing
//   weak   — the counter-leg completes without that break
//   unresolved — no counter-leg yet
function deriveSwingStrength(swings) {
  return swings.map((swing, index) => {
    const prior = index > 0 ? swings[index - 1] : null;
    const counterLeg = index + 1 < swings.length ? swings[index + 1] : null;
    if (!prior || !counterLeg) return { swing, strength: 'unresolved' };
    const broke = swing.kind === 'high'
      ? counterLeg.price < prior.price
      : counterLeg.price > prior.price;
    return { swing, strength: broke ? 'strong' : 'weak' };
  });
}

// equilibrium.py: compute_dealing_range. Anchors on the most recent strong
// swing of EITHER kind — pairing the last strong low with the last strong high
// can invert in a trend.
function computeDealingRange(swings) {
  const entries = deriveSwingStrength(swings);
  let anchorIndex = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].strength === 'strong') { anchorIndex = i; break; }
  }
  if (anchorIndex === -1) return null;

  const anchor = swings[anchorIndex];
  let extreme = null;
  for (const swing of swings.slice(anchorIndex + 1)) {
    if (swing.kind === anchor.kind) continue;
    if (extreme === null
      || (anchor.kind === 'low' ? swing.price > extreme.price : swing.price < extreme.price)) {
      extreme = swing;
    }
  }
  if (extreme === null) return null;

  const low = anchor.kind === 'low' ? anchor : extreme;
  const high = anchor.kind === 'low' ? extreme : anchor;
  if (low.price >= high.price) return null;

  return { low, high, anchor: anchor.kind, equilibrium: (low.price + high.price) / 2 };
}

// equilibrium.py: classify_price. No tolerance band, deliberately.
function classifyPrice(range, price) {
  if (price > range.equilibrium) return 'premium';
  if (price < range.equilibrium) return 'discount';
  return 'equilibrium';
}

// Convenience for callers: where does the close of the last visible bar sit?
// Returns null when no dealing range exists — "absence is a first-class
// outcome, never fabricated from unproven swings" (EDR 0005).
function locationAt(candles) {
  const swings = toAlternatingSwings(computePivots(candles));
  const range = computeDealingRange(swings);
  if (!range) return null;
  const price = candles[candles.length - 1].close;
  return {
    position: classifyPrice(range, price),
    equilibrium: range.equilibrium,
    low: range.low.price,
    high: range.high.price,
    anchor: range.anchor,
    // 0 at the range low, 1 at the range high.
    percentile: (price - range.low.price) / (range.high.price - range.low.price),
  };
}

module.exports = {
  pivotWindow, computePivots, toAlternatingSwings, deriveSwingStrength,
  computeDealingRange, classifyPrice, locationAt,
};
