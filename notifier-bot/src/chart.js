// Renders a dark-theme candlestick chart with entry/stop/target lines as a
// PNG, using the Chromium that's pre-installed in this environment
// (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers) via Playwright + Lightweight
// Charts v4.
//
// The library is vendored and inlined into the page (src/chart/vendor/), not
// pulled from a CDN: the renderer runs on every notified alert and a page that
// needs the network to draw is a page that eventually fails to draw.
//
// When a forecast is supplied it is drawn as a *second* candlestick series,
// translucent, behind an expanding confidence wedge, with a dashed path, a
// vertical divider at the boundary and a "FORECAST" chip. All of that exists
// for one reason: a projection that can be mistaken for history is worse than
// no projection at all.

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

const VENDOR_PATH = path.join(__dirname, 'chart', 'vendor', 'lightweight-charts.standalone.production.js');
let vendorSource = null;

function lightweightChartsSource() {
  if (vendorSource === null) vendorSource = fs.readFileSync(VENDOR_PATH, 'utf8');
  return vendorSource;
}

function buildHtml({ candles, entry, stop, target, title, width, height, forecast }) {
  const payload = JSON.stringify({ candles, entry, stop, target, title, forecast: forecast || null });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#0e1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
    #chart{position:relative;width:${width}px;height:${height}px;background:#0e1117;}
    #title{position:absolute;left:14px;top:10px;z-index:3;color:#e6edf3;font-size:15px;font-weight:600;
           text-shadow:0 1px 3px rgba(0,0,0,0.8);pointer-events:none;}
    #forecast-chip{position:absolute;right:14px;top:10px;z-index:3;padding:3px 9px;border-radius:4px;
           background:rgba(0,180,255,0.12);color:#7dd3fc;border:1px solid rgba(0,180,255,0.4);
           font-size:11px;font-weight:600;letter-spacing:0.5px;pointer-events:none;}
    #divider{position:absolute;top:0;bottom:22px;width:0;border-left:1px dashed rgba(0,180,255,0.45);z-index:2;
           pointer-events:none;display:none;}
    #footer{position:absolute;right:78px;bottom:26px;z-index:3;color:#7dd3fc;font-size:11px;text-align:right;
           text-shadow:0 1px 3px rgba(0,0,0,0.9);pointer-events:none;}
    #footer .sub{color:#6b7280;font-size:10px;}
  </style></head><body>
  <div id="chart">
    <div id="title"></div>
    <div id="divider"></div>
  </div>
  <script>${lightweightChartsSource()}</script>
  <script>
  const data = ${payload};
  const el = document.getElementById('chart');
  document.getElementById('title').textContent = data.title || '';

  // Both crypto (Binance) and stock (Yahoo) candles carry unix seconds, but a
  // millisecond series would silently sort into the year 56000 — normalise
  // rather than trust the caller.
  const toTime = (t) => (t > 1e11 ? Math.floor(t / 1000) : Math.floor(t));

  const chart = LightweightCharts.createChart(el, {
    width: ${width},
    height: ${height},
    layout: { background: { color: '#0e1117' }, textColor: '#8a8f98', fontSize: 11, attributionLogo: false },
    grid: { vertLines: { color: '#191d24' }, horzLines: { color: '#22262f' } },
    rightPriceScale: { borderColor: '#22262f', scaleMargins: { top: 0.12, bottom: 0.1 } },
    timeScale: { borderColor: '#22262f', timeVisible: true, secondsVisible: false, rightOffset: 2 },
    crosshair: { mode: 0 },
    handleScroll: false,
    handleScale: false,
  });

  // Price lines do not participate in autoscale, so a target sitting above the
  // candles would fall off the top of the pane — widen the range by hand.
  const levels = [data.entry, data.stop, data.target].filter((v) => typeof v === 'number' && isFinite(v));

  const realSeries = chart.addCandlestickSeries({
    upColor: '#3fb950', downColor: '#f85149',
    borderUpColor: '#3fb950', borderDownColor: '#f85149',
    wickUpColor: '#3fb950', wickDownColor: '#f85149',
    autoscaleInfoProvider: (original) => {
      const res = original();
      if (!res || !res.priceRange || !levels.length) return res;
      return {
        ...res,
        priceRange: {
          minValue: Math.min(res.priceRange.minValue, ...levels),
          maxValue: Math.max(res.priceRange.maxValue, ...levels),
        },
      };
    },
  });
  const realData = data.candles.map((c) => ({
    time: toTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close,
  }));
  realSeries.setData(realData);

  const lastReal = realData[realData.length - 1];

  if (data.forecast && data.forecast.candles && data.forecast.candles.length) {
    const fc = data.forecast.candles
      .map((c) => ({ time: toTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close }))
      .filter((c) => c.time > lastReal.time);

    const cone = (data.forecast.cone || [])
      .map((p) => ({ time: toTime(p.time), upper: p.upper, lower: p.lower }))
      .filter((p) => p.time > lastReal.time);

    // Confidence wedge first so everything else paints on top of it. An area
    // series fills to the bottom of the pane rather than to the cone's lower
    // bound; at 8% alpha that reads as a widening band, which is the point.
    if (cone.length) {
      const coneSeries = chart.addAreaSeries({
        lineColor: 'rgba(0,180,255,0)',
        lineWidth: 0,
        topColor: 'rgba(0,180,255,0.08)',
        bottomColor: 'rgba(0,180,255,0.02)',
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      coneSeries.setData(
        [{ time: lastReal.time, value: lastReal.close }].concat(cone.map((p) => ({ time: p.time, value: p.upper })))
      );
    }

    if (fc.length) {
      const forecastSeries = chart.addCandlestickSeries({
        upColor: 'rgba(0,180,255,0.35)',
        downColor: 'rgba(255,120,120,0.35)',
        borderVisible: false,
        wickUpColor: 'rgba(0,180,255,0.35)',
        wickDownColor: 'rgba(255,120,120,0.35)',
        priceLineVisible: false,
        lastValueVisible: false,
      });
      forecastSeries.setData(fc);

      const pathSeries = chart.addLineSeries({
        color: 'rgba(0,180,255,0.6)',
        lineStyle: 2, // dashed
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      pathSeries.setData(
        [{ time: lastReal.time, value: lastReal.close }].concat(fc.map((c) => ({ time: c.time, value: c.close })))
      );
    }

    const chip = document.createElement('div');
    chip.id = 'forecast-chip';
    chip.textContent = 'FORECAST \\u27F6';
    el.appendChild(chip);

    const m = data.forecast.metadata || {};
    const pct = (v) => (typeof v === 'number' ? Math.round(v * 100) + '%' : '—');
    const bars = (v) => (typeof v === 'number' ? '~' + Math.round(v) + ' bar ke TP' : '— bar ke TP');
    const footer = document.createElement('div');
    footer.id = 'footer';
    footer.innerHTML =
      '🎯 TP ~' + pct(m.tpHitProbability) + ' · SL ~' + pct(m.slHitProbability) + ' · ' + bars(m.barsToTp) +
      '<br><span class="sub">proyeksi · engine v' + (m.engineVersion != null ? m.engineVersion : '?') + '</span>';
    el.appendChild(footer);
  }

  function level(price, color, label) {
    if (price == null) return;
    realSeries.createPriceLine({
      price, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: label,
    });
  }
  level(data.entry, '#58a6ff', 'Entry');
  level(data.stop, '#f85149', 'Stop');
  level(data.target, '#3fb950', 'Target');

  chart.timeScale().fitContent();

  // The divider sits at the last real candle, so it can only be positioned
  // after the time scale has actually laid out — asking for the coordinate
  // before the next paint returns the pre-fitContent position.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (data.forecast) {
      const x = chart.timeScale().timeToCoordinate(lastReal.time);
      if (x != null) {
        const divider = document.getElementById('divider');
        divider.style.left = Math.round(x) + 'px';
        divider.style.display = 'block';
      }
    }
    requestAnimationFrame(() => { window.__chartReady = true; });
  }));
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

  async render({ candles, entry, stop, target, title, width = 900, height = 500, forecast = null }) {
    await this.init();
    const page = await this.browser.newPage({ viewport: { width, height } });
    try {
      const trimmed = candles.slice(-60);
      await page.setContent(buildHtml({ candles: trimmed, entry, stop, target, title, width, height, forecast }));
      await page.waitForFunction('window.__chartReady === true', { timeout: 10_000 });
      const container = await page.$('#chart');
      return await container.screenshot({ type: 'png' });
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
