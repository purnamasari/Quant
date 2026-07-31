// Smoke test for the forecast engine. No framework on purpose — this repo has
// no test runner and the properties worth checking here (determinism, OHLC
// sanity, monotone confidence) are cheap assertions.
//
//   node src/forecast/engine.test.js

const { generateForecast, createSeededRng } = require('./engine');

let failures = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function synthCandles(n = 60, start = 90, end = 100, seed = 'candles') {
  const rng = createSeededRng(seed);
  const out = [];
  let price = start;
  const stepUp = (end - start) / n;
  for (let i = 0; i < n; i++) {
    const open = price;
    const close = open + stepUp + (rng() - 0.5) * 1.2;
    const high = Math.max(open, close) + rng() * 0.6;
    const low = Math.min(open, close) - rng() * 0.6;
    out.push({ time: 1_700_000_000 + i * 3600, open, high, low, close, volume: 1000 + rng() * 500 });
    price = close;
  }
  return out;
}

const candles = synthCandles();
const baseInput = {
  candles,
  direction: 'long',
  takeProfit: 112,
  stopLoss: 96,
  entry: 100,
  regime: 'bull',
  seed: 'unit-test',
};

// --- determinism ---------------------------------------------------------
const a = generateForecast(baseInput);
const b = generateForecast(baseInput);
check('determinism: same seed → identical output', JSON.stringify(a) === JSON.stringify(b));

const other = generateForecast({ ...baseInput, seed: 'different-seed' });
check('different seeds → different output', JSON.stringify(a) !== JSON.stringify(other));

// --- shape + OHLC sanity -------------------------------------------------
check('default candleCount is 12', a.candles.length === 12, `got ${a.candles.length}`);
check('cone length matches candles', a.cone.length === a.candles.length);

const ohlcOk = a.candles.every((c) => c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close));
check('every candle: high >= max(open,close), low <= min(open,close)', ohlcOk);

const timesAscend = a.candles.every((c, i) => i === 0 || c.time > a.candles[i - 1].time);
check('forecast times strictly ascending', timesAscend);
check('forecast starts after last real candle', a.candles[0].time > candles[candles.length - 1].time);

// --- confidence ----------------------------------------------------------
const confInRange = a.candles.every((c) => c.confidence >= 0.05 && c.confidence <= 0.95);
check('confidence within [0.05, 0.95]', confInRange);

const confMonotone = a.candles.every((c, i) => i === 0 || c.confidence <= a.candles[i - 1].confidence);
check('confidence non-increasing', confMonotone);
check('candle 1 confidence ≈ 0.95', Math.abs(a.candles[0].confidence - 0.95) < 1e-9, `got ${a.candles[0].confidence}`);
check('candle 12 confidence ≈ 0.40', Math.abs(a.candles[11].confidence - 0.399) < 0.02, `got ${a.candles[11].confidence}`);

// --- cone ----------------------------------------------------------------
const widths = a.cone.map((c) => (c.upper - c.lower) / 2);
const widthGrows = widths.every((w, i) => i === 0 || w > widths[i - 1]);
check('cone width grows with i', widthGrows, `first ${widths[0].toFixed(3)} last ${widths[widths.length - 1].toFixed(3)}`);

// --- probabilities -------------------------------------------------------
const { tpHitProbability, slHitProbability, barsToTp, barsToSl } = a.metadata;
check('tpHitProbability in [0,1]', tpHitProbability >= 0 && tpHitProbability <= 1, String(tpHitProbability));
check('slHitProbability in [0,1]', slHitProbability >= 0 && slHitProbability <= 1, String(slHitProbability));
check('probabilities sum <= 1', tpHitProbability + slHitProbability <= 1 + 1e-9);
check('barsToTp null or in (0, n]', barsToTp === null || (barsToTp > 0 && barsToTp <= 12), String(barsToTp));
check('barsToSl null or in (0, n]', barsToSl === null || (barsToSl > 0 && barsToSl <= 12), String(barsToSl));

// --- statistical sanity: a long should drift up on average ---------------
const lastClose = candles[candles.length - 1].close;
let driftSum = 0;
for (let s = 0; s < 50; s++) {
  const f = generateForecast({ ...baseInput, seed: `drift-${s}` });
  driftSum += f.candles[f.candles.length - 1].close - lastClose;
}
const meanDrift = driftSum / 50;
check('long projection: mean drift over 50 seeds is positive', meanDrift > 0, `mean drift ${meanDrift.toFixed(4)}`);

// A short mirrors it — same setup, inverted plan.
let shortDriftSum = 0;
for (let s = 0; s < 50; s++) {
  const f = generateForecast({
    ...baseInput, direction: 'short', takeProfit: 88, stopLoss: 104, seed: `sdrift-${s}`,
  });
  shortDriftSum += f.candles[f.candles.length - 1].close - lastClose;
}
const meanShortDrift = shortDriftSum / 50;
check('short projection: mean drift over 50 seeds is negative', meanShortDrift < 0, `mean drift ${meanShortDrift.toFixed(4)}`);

// --- metadata ------------------------------------------------------------
check('inputsUsed marks defaulted trendStrength', a.metadata.inputsUsed.trendStrengthProvided === false);
check('inputsUsed marks provided trendStrength', generateForecast({ ...baseInput, trendStrength: 0.8 }).metadata.inputsUsed.trendStrengthProvided === true);
check('metadata carries seed + engineVersion', a.metadata.seed === 'unit-test' && typeof a.metadata.engineVersion === 'number');

if (failures) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('\nall assertions passed');
