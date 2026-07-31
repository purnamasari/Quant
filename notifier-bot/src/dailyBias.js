// Daily BTC context message, sent once every morning (08:00 WIB) regardless of
// whether any signal fired. The signal scan is silent on quiet days by design,
// and silence reads identically to "nothing was checked" — this is the standing
// answer to "what is the market doing today".
//
// Worded as context, never as an entry, for the same reason as
// formatStructureAlert: BTC structure breaks measured indistinguishable from
// noise on forward returns (see data/crypto-signal-validation.md). Regime and
// bias tell you how to read the day's signals, not what to buy.
//
// sendMessage only — no getUpdates. The bot token is shared with the tracking
// poller, and a second consumer of getUpdates would steal its callbacks.

const { sendMessage, sendPhoto } = require('./telegram');
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
// message and a re-run would read as a live prediction.
function todayYmd(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

// Context levels, not a trade plan: ±2 ATR around the close in and against the
// standing bias, so the projection has something to aim at and the footer
// probability answers "does today's bias hold for a week", not "should I buy".
function buildForecast({ daily, dStruct, regime }) {
  try {
    const lastClose = daily[daily.length - 1].close;
    const a = atr(daily, 14) || lastClose * 0.02;
    const direction = (dStruct.bias === 'bearish' || (!dStruct.bias && regime === 'bear')) ? 'short' : 'long';
    const sign = direction === 'long' ? 1 : -1;
    const forecast = generateForecast({
      candles: daily.slice(-60),
      direction,
      takeProfit: lastClose + sign * 2 * a,
      stopLoss: lastClose - sign * 2 * a,
      entry: lastClose,
      regime,
      // An explicit structure bias earns more drift than a regime-only guess.
      trendStrength: dStruct.bias ? 0.6 : 0.35,
      candleCount: 7, // one-week outlook
      seed: djb2(`BTC|daily-bias|${todayYmd()}`),
    });
    return { forecast, lastClose, atrValue: a, sign };
  } catch (err) {
    console.error('[dailyBias] forecast failed:', err.message);
    return { forecast: null };
  }
}

// Never allowed to break the message: a failed render degrades to text-only.
async function renderImage({ daily, forecast, lastClose, atrValue, sign }) {
  if (!forecast) return null;
  try {
    const r = await getRenderer();
    return await r.render({
      candles: daily.slice(-60),
      entry: lastClose,
      stop: lastClose - sign * 2 * atrValue,
      target: lastClose + sign * 2 * atrValue,
      // Short title on purpose — the PNG footer already carries the metadata.
      title: `BTCUSDT — Daily Bias ${wibDate()}`,
      forecast,
    });
  } catch (err) {
    console.error('[dailyBias] chart render failed:', err.message);
    return null;
  }
}

function buildMessage({ regime, daily, fourHour, candles, forecast = null }) {
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
    ...(forecast ? [
      `🎯 Forecast 7d: bias bertahan ~${Math.round(forecast.metadata.tpHitProbability * 100)}%` +
      ` · gagal ~${Math.round(forecast.metadata.slHitProbability * 100)}%`,
    ] : []),
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

    const { forecast, lastClose, atrValue, sign } = buildForecast({ daily, dStruct, regime });

    const text = buildMessage({ regime, daily: dStruct, fourHour, candles: daily, forecast });
    console.log(text);

    const png = await renderImage({ daily, forecast, lastClose, atrValue, sign });
    // Exactly one message: photo when the chart rendered, plain text otherwise.
    if (png) await sendPhoto(png, text);
    else await sendMessage(text);

    console.log(`[dailyBias] sent — regime ${regime ?? 'unknown'}, 1D ${dStruct.bias ?? 'unknown'}, 4H ${fourHour.bias ?? 'unknown'}, chart ${png ? 'yes' : 'no'}`);
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

module.exports = { main, buildMessage, buildForecast, renderImage, todayYmd, sma, changePercent };
