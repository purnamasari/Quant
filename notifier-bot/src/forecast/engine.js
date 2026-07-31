// ForecastEngine — deterministic, seeded projection of what the detected setup
// would plausibly look like over the next N bars.
//
// This is NOT a prediction and not a model fit to anything. It is a seeded
// random walk shaped by the engine's own plan (entry/stop/target, ATR,
// direction, signal strength) so an alert chart can show the expected path of
// the setup instead of stopping dead at the last real candle. Same input plus
// same seed always renders the same picture — a chart that changed every time
// it re-rendered would look like an oracle rather than an illustration.
//
// The projection math is isolated in projectPath() on purpose: swapping in a
// Monte Carlo / ARIMA / learned model later means replacing that one function,
// with the caller and the UI untouched (both consume only ForecastResult).

const { atr } = require('../risk');

const FORECAST_ENGINE_VERSION = 1;

const DEFAULT_CANDLE_COUNT = 12;
const DEFAULT_TREND_STRENGTH = 0.35;
const DEFAULT_SIGNAL_STRENGTH = 0.5;
const DEFAULT_VOLATILITY_FACTOR = 1.0;
const DEFAULT_BAR_INTERVAL = 3600_000;

// Probabilities of the three liquidity behaviours. Without them the projection
// is a visibly synthetic straight line; markets pull back, overshoot round
// levels and sweep stops, so the projection does too.
const P_PULLBACK = 0.28;
const P_FAKE_BREAKOUT = 0.3;
const P_SWEEP = 0.1;

const CONFIDENCE_START = 0.95;
const CONFIDENCE_END = 0.42;
const ENSEMBLE_PATHS = 200;

/**
 * @typedef {Object} ForecastInput
 * @property {Array<{time:number, open:number, high:number, low:number, close:number, volume:number}>} candles  // recent real candles (ATR + context)
 * @property {'long'|'short'} direction
 * @property {number} [trendStrength]      // 0..1; default derived from signal score, else 0.35
 * @property {number} [signalStrength]     // 0..1; default 0.5
 * @property {number} [volatilityFactor]   // default 1.0
 * @property {number} takeProfit           // engine target price
 * @property {number} stopLoss             // engine stop price
 * @property {number} entry                // plan entry price
 * @property {string|null} [regime]        // 'bull'|'bear'|'sideways'|null
 * @property {number} [candleCount]        // default 12
 * @property {number|string} [seed]        // default: djb2 hash of symbol+kind+date (caller supplies)
 */

/**
 * @typedef {Object} ForecastCandle
 * @property {number} time
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} confidence  // 0..1, decays over the projection
 */

/**
 * @typedef {Object} ForecastResult
 * @property {ForecastCandle[]} candles
 * @property {Array<{time:number, upper:number, lower:number}>} cone   // confidence band, width = ATR*sqrt(i)
 * @property {Object} metadata
 * @property {number} metadata.tpHitProbability   // 0..1
 * @property {number} metadata.slHitProbability   // 0..1
 * @property {number|null} metadata.barsToTp      // mean bars to TP among hit paths, null if none
 * @property {number|null} metadata.barsToSl      // mean bars to SL among hit paths, null if none
 * @property {number} metadata.engineVersion
 * @property {number|string} metadata.seed
 * @property {number} metadata.candleCount
 * @property {Object} metadata.inputsUsed         // snapshot of what was used vs defaulted
 */

// djb2. Used both to turn a string seed into a uint32 and to derive the
// ensemble's sub-seeds, so a single caller-supplied seed fixes everything.
function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

/**
 * mulberry32 PRNG. Deterministic, tiny, good enough for visual projection.
 * @param {number|string} seed
 * @returns {() => number} float in [0,1)
 */
function createSeededRng(seed) {
  let state = (typeof seed === 'number' ? seed : djb2(String(seed))) >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller. @param {() => number} rng @returns {number} N(0,1) */
function gaussian(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng(); // log(0) guard
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

// Bar spacing from the real series rather than from config: the same engine
// runs on 1h crypto and daily stocks, and the projection has to land on the
// grid the chart already uses.
function estimateBarInterval(candles) {
  const times = candles.slice(-11).map((c) => c.time);
  const deltas = [];
  for (let i = 1; i < times.length; i++) {
    const d = times[i] - times[i - 1];
    if (d > 0) deltas.push(d);
  }
  if (!deltas.length) return DEFAULT_BAR_INTERVAL;
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)];
}

// Drift shared by the rendered path and the probability ensemble. Two terms:
// a trend push along the signal direction, and a pull toward the engine's own
// target. The TP-pull is clamped because on a far target it would otherwise
// swamp both the trend term and the noise and draw a ruler-straight line.
function driftFor({ pc, atrValue, trendStrength, directionBias, takeProfit }) {
  const trend = trendStrength * atrValue * directionBias * 0.5;
  const tpPull = clamp((takeProfit - pc) * 0.06, -0.75 * atrValue, 0.75 * atrValue);
  return trend + tpPull;
}

/**
 * The one function a different forecasting model would replace. Everything
 * else in this file (seeding, confidence, cone, ensemble, metadata) is model
 * agnostic.
 *
 * @returns {Array<{time:number, open:number, high:number, low:number, close:number}>}
 */
function projectPath(input, rng) {
  const {
    candles, direction, trendStrength, volatilityFactor,
    takeProfit, stopLoss, entry, candleCount, atrValue, barInterval,
  } = input;

  const last = candles[candles.length - 1];
  const directionBias = direction === 'long' ? 1 : -1;
  // Written as min/max rather than literally stopLoss-3*ATR so a short (where
  // the stop sits above the target) gets a sane band instead of an inverted one.
  const floorPrice = Math.min(stopLoss, takeProfit) - 3 * atrValue;
  const ceilPrice = Math.max(stopLoss, takeProfit) + 3 * atrValue;

  const out = [];
  let pc = last.close;
  let prevLow = last.low;
  let prevHigh = last.high;

  for (let i = 1; i <= candleCount; i++) {
    const drift = driftFor({ pc, atrValue, trendStrength, directionBias, takeProfit });
    const noise = gaussian(rng) * atrValue * volatilityFactor;
    const upperWick = Math.abs(gaussian(rng)) * atrValue * 0.35;
    const lowerWick = Math.abs(gaussian(rng)) * atrValue * 0.35;
    // Rolled unconditionally, in a fixed order, so the RNG stream does not
    // depend on which branch fired — determinism has to survive refactoring.
    const rollPullback = rng();
    const rollFake = rng();
    const rollSweep = rng();

    const open = pc;
    let close = pc + drift + noise;

    if (rollPullback < P_PULLBACK) {
      // Counter-bias candle: red inside an uptrend, green inside a downtrend.
      const body = Math.max(Math.abs(close - open) * 0.35, atrValue * 0.1);
      close = open - directionBias * body;
    }

    let high = Math.max(open, close) + upperWick;
    let low = Math.min(open, close) - lowerWick;

    if (Math.abs(close - takeProfit) <= 0.35 * atrValue && rollFake < P_FAKE_BREAKOUT) {
      // Fake breakout: wick through the target, close back inside it.
      if (directionBias === 1) {
        high = Math.max(high, takeProfit + 0.15 * atrValue);
        close = Math.min(close, takeProfit - 0.05 * atrValue);
      } else {
        low = Math.min(low, takeProfit - 0.15 * atrValue);
        close = Math.max(close, takeProfit + 0.05 * atrValue);
      }
    }

    if (rollSweep < P_SWEEP) {
      // Liquidity sweep: take out the obvious resting stops, then recover
      // back toward the open.
      if (directionBias === 1) {
        const sweepTo = Math.min(prevLow, entry - 0.5 * atrValue) - 0.05 * atrValue;
        low = Math.min(low, sweepTo);
      } else {
        const sweepTo = Math.max(prevHigh, entry + 0.5 * atrValue) + 0.05 * atrValue;
        high = Math.max(high, sweepTo);
      }
      close = open + (close - open) * 0.25;
    }

    const c = {
      time: last.time + i * barInterval,
      open: clamp(open, floorPrice, ceilPrice),
      close: clamp(close, floorPrice, ceilPrice),
      high: clamp(high, floorPrice, ceilPrice),
      low: clamp(low, floorPrice, ceilPrice),
    };
    // Re-assert OHLC sanity last: the clamps above can push a wick inside the
    // body, and a candle with high < close renders as a broken glyph.
    c.high = Math.max(c.high, c.open, c.close);
    c.low = Math.min(c.low, c.open, c.close);

    out.push(c);
    pc = c.close;
    prevLow = c.low;
    prevHigh = c.high;
  }

  return out;
}

// Hit probabilities come from an ensemble rather than from the single rendered
// path — one path says nothing about likelihood. The liquidity behaviours are
// deliberately left out here: they are a drawing device, and letting synthetic
// sweeps trigger synthetic stops would bias the number the user reads.
function runEnsemble(input) {
  const { candles, direction, trendStrength, volatilityFactor, takeProfit, stopLoss, candleCount, atrValue, seed } = input;
  const last = candles[candles.length - 1];
  const directionBias = direction === 'long' ? 1 : -1;

  let tpHits = 0;
  let slHits = 0;
  let tpBarSum = 0;
  let slBarSum = 0;

  for (let k = 0; k < ENSEMBLE_PATHS; k++) {
    const rng = createSeededRng(djb2(`${seed}|${k}`));
    let pc = last.close;
    for (let i = 1; i <= candleCount; i++) {
      const drift = driftFor({ pc, atrValue, trendStrength, directionBias, takeProfit });
      const noise = gaussian(rng) * atrValue * volatilityFactor;
      const open = pc;
      const close = pc + drift + noise;
      const high = Math.max(open, close) + Math.abs(gaussian(rng)) * atrValue * 0.35;
      const low = Math.min(open, close) - Math.abs(gaussian(rng)) * atrValue * 0.35;

      const hitTp = directionBias === 1 ? high >= takeProfit : low <= takeProfit;
      const hitSl = directionBias === 1 ? low <= stopLoss : high >= stopLoss;
      // Intrabar, both levels touched in the same candle: no tick data to say
      // which came first, so credit the stop. Optimistic is the wrong default
      // for a number shown next to a trade idea.
      if (hitSl) {
        slHits += 1;
        slBarSum += i;
        break;
      }
      if (hitTp) {
        tpHits += 1;
        tpBarSum += i;
        break;
      }
      pc = close;
    }
  }

  return {
    tpHitProbability: tpHits / ENSEMBLE_PATHS,
    slHitProbability: slHits / ENSEMBLE_PATHS,
    barsToTp: tpHits ? tpBarSum / tpHits : null,
    barsToSl: slHits ? slBarSum / slHits : null,
  };
}

/**
 * @param {ForecastInput} input
 * @returns {ForecastResult}
 */
function generateForecast(input) {
  const candles = Array.isArray(input?.candles) ? input.candles : [];
  if (!candles.length) throw new Error('generateForecast: candles required');
  if (input.direction !== 'long' && input.direction !== 'short') {
    throw new Error(`generateForecast: direction must be long|short, got ${input.direction}`);
  }
  for (const key of ['takeProfit', 'stopLoss', 'entry']) {
    if (!Number.isFinite(input[key])) throw new Error(`generateForecast: ${key} must be a finite number`);
  }

  const last = candles[candles.length - 1];
  const signalStrength = Number.isFinite(input.signalStrength) ? input.signalStrength : DEFAULT_SIGNAL_STRENGTH;
  // Trend defaults off the signal score when the caller has one: a 19/20
  // setup should project harder than a bare-minimum trigger.
  const trendStrength = Number.isFinite(input.trendStrength)
    ? input.trendStrength
    : (Number.isFinite(input.signalStrength) ? input.signalStrength : DEFAULT_TREND_STRENGTH);
  const volatilityFactor = Number.isFinite(input.volatilityFactor) ? input.volatilityFactor : DEFAULT_VOLATILITY_FACTOR;
  const candleCount = Number.isFinite(input.candleCount) ? Math.max(2, Math.floor(input.candleCount)) : DEFAULT_CANDLE_COUNT;
  const seed = input.seed === undefined || input.seed === null ? 0 : input.seed;
  const atrValue = atr(candles, 14) || last.close * 0.02;
  const barInterval = estimateBarInterval(candles);

  const resolved = {
    candles,
    direction: input.direction,
    trendStrength,
    volatilityFactor,
    takeProfit: input.takeProfit,
    stopLoss: input.stopLoss,
    entry: input.entry,
    candleCount,
    atrValue,
    barInterval,
    seed,
  };

  const rng = createSeededRng(seed);
  const path = projectPath(resolved, rng);

  const forecastCandles = path.map((c, idx) => {
    const step = idx; // 0-based: candle 1 carries the full starting confidence
    const raw = CONFIDENCE_START * (1 - (step * (1 - CONFIDENCE_END)) / (candleCount - 1));
    return { ...c, confidence: clamp(Number(raw.toFixed(3)), 0.05, 0.95) };
  });

  const cone = forecastCandles.map((c, idx) => {
    const width = atrValue * Math.sqrt(idx + 1);
    return { time: c.time, upper: c.close + width, lower: c.close - width };
  });

  const ensemble = runEnsemble(resolved);

  return {
    candles: forecastCandles,
    cone,
    metadata: {
      ...ensemble,
      engineVersion: FORECAST_ENGINE_VERSION,
      seed,
      candleCount,
      inputsUsed: {
        atr: atrValue,
        atrSource: atr(candles, 14) ? 'atr14' : 'fallback-2pct',
        barInterval,
        trendStrength,
        trendStrengthProvided: Number.isFinite(input.trendStrength),
        signalStrength,
        signalStrengthProvided: Number.isFinite(input.signalStrength),
        volatilityFactor,
        volatilityFactorProvided: Number.isFinite(input.volatilityFactor),
        candleCountProvided: Number.isFinite(input.candleCount),
        seedProvided: input.seed !== undefined && input.seed !== null,
        regime: input.regime ?? null,
        realCandles: candles.length,
      },
    },
  };
}

module.exports = { generateForecast, createSeededRng, djb2, FORECAST_ENGINE_VERSION };
