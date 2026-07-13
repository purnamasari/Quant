import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = path.join(os.tmpdir(), `quant-test-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const outfile = path.join(tmp, 'quant.mjs');
const signalsOutfile = path.join(tmp, 'signals.mjs');
const harnessOutfile = path.join(tmp, 'harness.mjs');
const llmOutfile = path.join(tmp, 'llm.mjs');

await build({
  entryPoints: [path.join(root, 'src/shared/quant.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile,
  logLevel: 'silent',
});

await build({
  entryPoints: [path.join(root, 'src/shared/llm.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: llmOutfile,
  logLevel: 'silent',
});

await build({
  entryPoints: [path.join(root, 'src/shared/harness.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: harnessOutfile,
  logLevel: 'silent',
});

await build({
  entryPoints: [path.join(root, 'src/shared/signals.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: signalsOutfile,
  logLevel: 'silent',
});

const quant = await import(pathToFileURL(outfile).href);
const signals = await import(pathToFileURL(signalsOutfile).href);
const harness = await import(pathToFileURL(harnessOutfile).href);
const llm = await import(pathToFileURL(llmOutfile).href);

function candles(count = 90) {
  const out = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const jump = i === count - 2 ? 4 : 0;
    const open = price;
    price += 0.18 + jump;
    const close = price;
    out.push({
      time: 1_700_000_000 + i * 86_400,
      open,
      high: close + 0.8,
      low: open - 0.6,
      close,
      volume: i > count - 5 ? 2_000_000 : 1_000_000,
    });
  }
  return out;
}

const series = candles();
const pivots = [
  { time: series[30].time, price: series[30].low, kind: 'low' },
  { time: series[55].time, price: series[55].high, kind: 'high' },
  { time: series[70].time, price: series[70].low, kind: 'low' },
];

const evaluation = quant.evaluateSignal('TST', series, pivots);
assert.equal(evaluation.symbol, 'TST');
assert.ok(evaluation.confidence >= 0 && evaluation.confidence <= 100);
assert.ok(evaluation.components.length >= 5);
assert.ok(evaluation.risk.entry > 0);
assert.ok(evaluation.risk.positionSize >= 0);
assert.equal(evaluation.strategyVersion, 'QuantDeskSignal_v1');

const backtest = quant.runBacktest(series);
assert.ok(backtest.totalTrades >= 0);
assert.ok(Number.isFinite(backtest.expectancy));
assert.ok(Number.isFinite(backtest.profitFactor));

const evidence = harness.buildQuantEvidence({
  symbol: 'TST',
  range: '1y',
  evaluation,
  news: [{
    id: 'news-1',
    title: 'Untrusted headline text',
    url: 'https://example.com',
    sourceName: 'Example',
    publishedAt: '2026-01-01T00:00:00.000Z',
    relatedSymbol: 'TST',
  }],
});
assert.ok(evidence.length >= 6);
assert.deepEqual(evidence.map((item) => item.id), evidence.map((_, index) => `E${index + 1}`));
assert.equal(evidence.find((item) => item.category === 'news')?.quality, 'warning');

const signalScan = signals.detectStockSignals(candles(160));
assert.ok(signalScan.metrics.lastClose > 0);
assert.ok(Array.isArray(signalScan.signals));
assert.ok(signalScan.signals.some((s) => s.kind === 'ma-alignment'));

assert.equal(llm.providerDefinition('local').baseUrl, 'http://127.0.0.1:8080/v1');
assert.equal(llm.providerDefinition('claude').requiresApiKey, true);
assert.equal(llm.normalizeApiBaseUrl('https://api.openai.com/v1///'), 'https://api.openai.com/v1');

rmSync(tmp, { recursive: true, force: true });
console.log('quant tests ok');
