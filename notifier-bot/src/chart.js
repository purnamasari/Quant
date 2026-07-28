// Renders a dark-theme candlestick chart with entry/stop/target lines as a
// PNG, using the Chromium that's pre-installed in this environment
// (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers) via Playwright + a plain
// <canvas> 2D drawing — no chart-library dependency, no network fetch
// inside the rendered page.

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

function findChromiumExecutable() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(base)) return undefined;
  const dir = fs.readdirSync(base).find((d) => /^chromium-\d+$/.test(d));
  if (!dir) return undefined;
  const candidate = path.join(base, dir, 'chrome-linux', 'chrome');
  return fs.existsSync(candidate) ? candidate : undefined;
}

const CHROMIUM_PATH = findChromiumExecutable();

function buildHtml({ candles, entry, stop, target, title, width, height }) {
  const payload = JSON.stringify({ candles, entry, stop, target, title });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#0e1117;}
    #c{display:block;}
  </style></head><body>
  <canvas id="c" width="${width}" height="${height}"></canvas>
  <script>
  const data = ${payload};
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const padL = 70, padR = 20, padT = 50, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  ctx.fillStyle = '#0e1117';
  ctx.fillRect(0, 0, W, H);

  const candles = data.candles;
  const allPrices = candles.flatMap(c => [c.high, c.low]).concat([data.entry, data.stop, data.target].filter(v => v != null));
  const maxP = Math.max(...allPrices) * 1.005;
  const minP = Math.min(...allPrices) * 0.995;
  const priceToY = (p) => padT + plotH * (1 - (p - minP) / (maxP - minP));

  const n = candles.length;
  const slot = plotW / n;
  const bodyW = Math.max(2, slot * 0.6);

  // grid + price labels
  ctx.strokeStyle = '#22262f';
  ctx.fillStyle = '#8a8f98';
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const p = minP + ((maxP - minP) * i) / gridLines;
    const y = priceToY(p);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.fillText(p.toFixed(2), padL - 8, y + 4);
  }

  // candles
  candles.forEach((c, i) => {
    const x = padL + i * slot + slot / 2;
    const up = c.close >= c.open;
    ctx.strokeStyle = up ? '#3fb950' : '#f85149';
    ctx.fillStyle = up ? '#3fb950' : '#f85149';
    ctx.beginPath();
    ctx.moveTo(x, priceToY(c.high));
    ctx.lineTo(x, priceToY(c.low));
    ctx.stroke();
    const yOpen = priceToY(c.open), yClose = priceToY(c.close);
    const top = Math.min(yOpen, yClose), h = Math.max(1, Math.abs(yClose - yOpen));
    ctx.fillRect(x - bodyW / 2, top, bodyW, h);
  });

  // entry/stop/target lines
  function levelLine(price, color, label) {
    if (price == null) return;
    const y = priceToY(price);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(label + ' ' + price.toFixed(2), padL + 8, y - 4);
  }
  levelLine(data.entry, '#58a6ff', 'Entry');
  levelLine(data.stop, '#f85149', 'Stop');
  levelLine(data.target, '#3fb950', 'Target');

  // title
  ctx.fillStyle = '#e6edf3';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(data.title, 16, 28);
  </script>
  </body></html>`;
}

class ChartRenderer {
  constructor() {
    this.browser = null;
  }

  async init() {
    if (this.browser) return;
    this.browser = await chromium.launch({
      executablePath: CHROMIUM_PATH,
      args: ['--no-sandbox'],
    });
  }

  async render({ candles, entry, stop, target, title, width = 900, height = 500 }) {
    await this.init();
    const page = await this.browser.newPage({ viewport: { width, height } });
    try {
      const trimmed = candles.slice(-60);
      await page.setContent(buildHtml({ candles: trimmed, entry, stop, target, title, width, height }));
      const canvas = await page.$('#c');
      return await canvas.screenshot({ type: 'png' });
    } finally {
      await page.close();
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = { ChartRenderer };
