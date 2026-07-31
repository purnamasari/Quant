// Daily BTC context message, sent once every morning (08:00 WIB) regardless of
// whether any signal fired. The signal scan is silent on quiet days by design,
// and silence reads identically to "nothing was checked" — this is the standing
// answer to "what is the market doing today".
//
// One message per day: caption + chart(s). Monday (WIB) sends BOTH the weekly
// 1D chart (7-candle forecast) and the intraday 4H chart (12-candle forecast)
// as a single album; Tuesday–Sunday send the 4H chart alone. The caption
// reports both the 1D and 4H bias every day either way.
//
// Worded as context, never as an entry, for the same reason as
// formatStructureAlert: BTC structure breaks measured indistinguishable from
// noise on forward returns (see data/crypto-signal-validation.md). Regime and
// bias tell you how to read the day's signals, not what to buy.
//
// sendMessage only — no getUpdates. The bot token is shared with the tracking
// poller, and a second consumer of getUpdates would steal its callbacks.

const { sendMessage, sendPhoto, sendMediaGroup } = require('./telegram');
const { getCandles } = require('./crypto/binance');
const { marketStructure } = require('./marketStructure');
const { classifyLatest, REGIME_LABEL, REGIME_EMOJI } = require('./regime');
const { atr } = require('./risk');
const { ChartRenderer } = require('./chart');
const { generateForecast } = require('./forecast/engine');
const { djb2 } = require('./forecast/input');

const SYMBOL = 'BTCUSDT';

// Lazy singleton: the daily run renders one chart, but keeping the shape the
// same as cryptoJob's means a second render later reuses the browser instead
// of launching a second chromium.
let renderer = null;
async function getRenderer() {
  if (!renderer) renderer = new ChartRenderer();
  return renderer;
}

// Mean of the last `length` closes. Falls back to whatever history exists
// rather than returning null: on a short series a 150-bar mean is still a more
// useful reference than no line at all, and the label says 200SMA because that
// is the regime definition, not because the sample is guaranteed full.
function sma(candles, length) {
  const slice = candles.slice(-length);
  if (!slice.length) return null;
  return slice.reduce((sum, c) => sum + c.close, 0) / slice.length;
}

function changePercent(candles, barsBack) {
  if (candles.length <= barsBack) return null;
  const then = candles[candles.length - 1 - barsBack].close;
  const now = candles[candles.length - 1].close;
  if (!then) return null;
  return ((now - then) / then) * 100;
}

function signed(value, digits = 1) {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

const REGIME_NOTE = {
  bear: 'Hati-hati tambah long baru; sinyal long butuh konfirmasi struktur.',
  bull: 'Pullback ke support = peluang; jangan fade tren.',
  sideways: 'Range — tunggu breakout, atau main di tepi range.',
};

function wibDate(date = new Date()) {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  });
}

// Jakarta calendar day, YYYY-MM-DD. Seeds the forecast so every render inside
// one WIB day draws the same projection — a picture that changed between the
// message and a re-run would read as a live prediction. One seed per WIB day is
// enough because only one chart is rendered per day, whichever timeframe wins.
function todayYmd(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

// Jakarta calendar weekday. Monday starts the trading week → weekly (1D)
// outlook; every other day → intraday (4H) outlook.
function isMondayWib(date = new Date()) {
  return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Jakarta' }) === 'Mon';
}

// Picks a timeframe's payload for the projection — levels, direction, forecast
// length — plus the chart title. Context levels, not a trade plan: ±2 ATR
// around the close in and against the standing bias, so the footer probability
// answers "does this bias hold for the next N candles", not "should I buy".
// `useDaily: true` → 1D weekly outlook (7 candles), `false` → 4H intraday
// outlook (12 candles).
function payloadFor({ daily, h4, dStruct, fourHour, regime, useDaily }) {
  const candles = useDaily ? daily : h4;
  const bias = useDaily ? dStruct.bias : fourHour.bias;
  const lastClose = candles[candles.length - 1].close;
  const atrValue = (useDaily ? atr(daily, 14) : atr(h4, 14)) || lastClose * 0.02;
  const direction = (bias === 'bearish' || (!bias && regime === 'bear')) ? 'short' : 'long';
  const sign = direction === 'long' ? 1 : -1;
  return {
    useDaily,
    candles,
    bias,
    lastClose,
    atrValue,
    direction,
    sign,
    candleCount: useDaily ? 7 : 12,
    label: useDaily ? '1D' : '4H',
    title: `BTCUSDT — Bias ${useDaily ? '1D (weekly)' : '4H (intraday)'} ${wibDate()}`,
  };
}

function buildForecast({ candles, bias, lastClose, atrValue, direction, sign, candleCount, regime }) {
  try {
    const forecast = generateForecast({
      candles: candles.slice(-60),
      direction,
      takeProfit: lastClose + sign * 2 * atrValue,
      stopLoss: lastClose - sign * 2 * atrValue,
      entry: lastClose,
      regime,
      // An explicit structure bias earns more drift than a regime-only guess.
      trendStrength: bias ? 0.6 : 0.35,
      candleCount,
      seed: djb2(`BTC|daily-bias|${todayYmd()}`),
    });
    return { forecast };
  } catch (err) {
    console.error('[dailyBias] forecast failed:', err.message);
    return { forecast: null };
  }
}

// Never allowed to break the message: a failed render degrades to text-only.
async function renderImage({ candles, forecast, lastClose, atrValue, sign, title }) {
  if (!forecast) return null;
  try {
    const r = await getRenderer();
    return await r.render({
      candles: candles.slice(-60),
      entry: lastClose,
      stop: lastClose - sign * 2 * atrValue,
      target: lastClose + sign * 2 * atrValue,
      // Short title on purpose — the PNG footer already carries the metadata.
      title,
      forecast,
    });
  } catch (err) {
    console.error('[dailyBias] chart render failed:', err.message);
    return null;
  }
}

// The text always reports BOTH biases — only the chart follows the weekday
// cadence. `forecastLines` are the 🎯 lines (already formatted, without the
// emoji); Monday contributes two (1D + 4H), other days one.
function buildMessage({ regime, daily, fourHour, candles, forecastLines = [] }) {
  const lastClose = candles[candles.length - 1].close;
  const sma200 = sma(candles, 200);
  const vsSma = sma200 ? ((lastClose - sma200) / sma200) * 100 : null;
  const conflict = daily.bias && fourHour.bias && daily.bias !== fourHour.bias;

  return [
    `📊 <b>Daily Bias BTC — ${wibDate()} WIB</b>`,
    `${REGIME_EMOJI[regime] || '❔'} Regime: <b>${REGIME_LABEL[regime] || 'UNKNOWN'}</b> (BTC 200SMA)`,
    `1D: <b>${daily.bias ? daily.bias.toUpperCase() : 'UNKNOWN'}</b>` +
    ` · 4H: <b>${fourHour.bias ? fourHour.bias.toUpperCase() : 'UNKNOWN'}</b>` +
    `${conflict ? ' ⚠️ konflik' : ''}`,
    `Close ${Math.round(lastClose).toLocaleString('id-ID')} · 7d ${signed(changePercent(candles, 7))}` +
    ` · 30d ${signed(changePercent(candles, 30))} · vs 200SMA ${signed(vsSma)}`,
    '',
    `📌 ${REGIME_NOTE[regime] || 'Tidak ada bias jelas hari ini.'}`,
    ...forecastLines.map((line) => `🎯 ${line}`),
    '<i>Regime = posisi harga vs 200SMA + slope. Bias = arah break struktur terakhir. ' +
    'Ini konteks, bukan sinyal entry.</i>',
  ].join('\n');
}

async function main() {
  try {
    const daily = await getCandles(SYMBOL, '1D', 300, { pauseMs: 100 });
    const h4 = await getCandles(SYMBOL, '4H', 300, { pauseMs: 100 });
    // Candles are passed in so marketStructure does not re-fetch what we hold.
    const { daily: dStruct, fourHour } = await marketStructure({
      dailyCandles: daily, fourHourCandles: h4,
    });
    const regime = classifyLatest(daily);

    // Monday = BOTH the weekly (1D) and intraday (4H) outlook as one album;
    // other days = intraday (4H) only.
    const monday = isMondayWib();
    const payloads = monday
      ? [
        payloadFor({ daily, h4, dStruct, fourHour, regime, useDaily: true }),
        payloadFor({ daily, h4, dStruct, fourHour, regime, useDaily: false }),
      ]
      : [payloadFor({ daily, h4, dStruct, fourHour, regime, useDaily: false })];

    const forecasts = payloads.map((p) => buildForecast({ ...p, regime }));
    const forecastLines = payloads
      .map((p, i) => {
        const f = forecasts[i].forecast;
        if (!f) return null;
        return `${p.label} (${p.candleCount} lilin): bias bertahan ~${Math.round(f.metadata.tpHitProbability * 100)}% · gagal ~${Math.round(f.metadata.slHitProbability * 100)}%`;
      })
      .filter(Boolean);

    const text = buildMessage({ regime, daily: dStruct, fourHour, candles: daily, forecastLines });
    console.log(text);

    const pngs = [];
    for (let i = 0; i < payloads.length; i++) {
      const png = await renderImage({ ...payloads[i], forecast: forecasts[i].forecast });
      if (png) pngs.push(png);
    }
    // Exactly one outbound message: an album when both charts rendered on
    // Monday, a single photo when only one did, plain text when none did.
    if (monday && pngs.length === 2) await sendMediaGroup(pngs, text);
    else if (pngs.length === 1) await sendPhoto(pngs[0], text);
    else await sendMessage(text);

    console.log(`[dailyBias] sent — regime ${regime ?? 'unknown'}, 1D ${dStruct.bias ?? 'unknown'}, 4H ${fourHour.bias ?? 'unknown'}, chart ${monday ? '1D+4H (album)' : '4H'} ${pngs.length ? 'yes' : 'no'}`);
  } catch (err) {
    console.error('[dailyBias] failed:', err.message);
    process.exit(1);
  } finally {
    if (renderer) await renderer.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[dailyBias] fatal:', err);
    process.exit(1);
  });
}

module.exports = {
  main, buildMessage, buildForecast, renderImage, payloadFor,
  todayYmd, isMondayWib, sma, changePercent,
};
