// Binance USDⓈ-M futures (fapi) public market-data client. Replaces the
// OKX client that was used while this environment could not reach Binance
// (it returned HTTP 451 "restricted location" back then; it now returns 200,
// so the substitution is no longer needed). fapi is the USDⓈ-M perpetuals
// venue, which is the user's actual trading venue — signals are now computed
// on the same prices they trade against, not a correlated proxy.
//
// Public endpoints only: no API key, no signing, no account access.
//
// NOTE: Binance kline `time` is the OPEN timestamp, same as OKX — the
// look-ahead pitfall documented in AGENTS.md still applies.

const BASE = 'https://fapi.binance.com';

// Transient-failure retry. Observed in practice: whole scans failing 12/12
// with HTTP 503 whose body reads "DNS resolution failure" — that text comes
// from the network path in front of us, not from the exchange, and direct
// requests to the same URLs succeed seconds later. Two such episodes occurred
// in one day, each clearing within a couple of minutes.
//
// Without a retry a single blip discards the entire scan, which for an hourly
// job means a whole hour of blindness. Retrying inside the client fixes it at
// the right level: one symbol's hiccup no longer costs the run.
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 800;

function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Retries on network errors and 5xx (transient), never on 4xx (a bad request
// will fail identically every time — retrying just wastes the rate limit).
async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status < 500) return res; // caller surfaces the 4xx
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < MAX_ATTEMPTS) await sleepMs(RETRY_BASE_MS * 2 ** (attempt - 1));
  }
  throw lastError;
}

// Accepts "BTCUSDT", "BTC-USDT" or the OKX swap form "BTC-USDT-SWAP" and
// always returns Binance's format: "BTCUSDT". Call sites and cached data
// still carry OKX-style ids, so tolerating them keeps them working.
function toInstId(symbol) {
  const raw = String(symbol).toUpperCase().replace(/-SWAP$/, '').replace(/-/g, '');
  const quote = raw.includes('USDT') ? 'USDT' : raw.slice(-3);
  const base = raw.slice(0, raw.length - quote.length);
  return `${base}${quote}`;
}

// OKX bar names ("1D", "4H") map onto Binance intervals ("1d", "4h"). The
// month bar is the one case where Binance wants a capital M, so it is checked
// before lower-casing.
const INTERVALS = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
};

function toInterval(bar) {
  if (bar === '1M') return '1M';
  const interval = INTERVALS[String(bar).toLowerCase()];
  if (!interval) throw new Error(`binance: unsupported bar ${bar}`);
  return interval;
}

const MAX_LIMIT = 1500; // Binance klines cap per request

async function getCandles(symbol, bar, count, { pauseMs = 0 } = {}) {
  const instId = toInstId(symbol);
  const interval = toInterval(bar);
  let candles = [];
  let endTime;
  while (candles.length < count) {
    const limit = Math.min(MAX_LIMIT, count - candles.length);
    const url = new URL(`${BASE}/fapi/v1/klines`);
    url.searchParams.set('symbol', instId);
    url.searchParams.set('interval', interval);
    url.searchParams.set('limit', String(limit));
    if (endTime !== undefined) url.searchParams.set('endTime', String(endTime));
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error(`binance klines ${instId}: HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(`binance klines ${instId}: ${rows && rows.msg}`);
    if (!rows.length) break;
    // Binance row: [openTime, o, h, l, c, vol, closeTime, quoteVol, trades,
    // takerBuyBase, takerBuyQuote, ignore] — ascending, oldest first.
    const page = rows.map((row) => ({
      time: Math.floor(Number(row[0]) / 1000),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
      confirmed: true,
    }));
    // Each extra request pages *backwards*, so older rows go in front.
    candles = page.concat(candles);
    endTime = Number(rows[0][0]) - 1;
    if (rows.length < limit) break; // no more history
    if (pauseMs) await sleepMs(pauseMs);
  }
  candles.sort((a, b) => a.time - b.time);
  const out = candles.slice(-count);
  // Unlike OKX there is no per-row confirm flag: Binance always returns the
  // current still-forming candle as the last row. Marking it unconfirmed
  // reproduces OKX's confirm=0 semantics, which cryptoJob.js relies on to
  // label alerts PROVISIONAL vs CONFIRMED.
  if (out.length) out[out.length - 1].confirmed = false;
  return out;
}

async function getDailyCandles(symbol, days = 300) {
  return getCandles(symbol, '1D', days);
}

// Tolerant by design: funding is supplementary context, so a symbol that is
// not a USDT perp (or a blip on this endpoint) must not fail the whole scan.
async function getFundingRate(symbol) {
  try {
    const instId = toInstId(symbol);
    const res = await fetchWithRetry(`${BASE}/fapi/v1/premiumIndex?symbol=${instId}`);
    if (!res || !res.ok) return null;
    const json = await res.json();
    if (!json || json.lastFundingRate === undefined) return null;
    return {
      instId,
      fundingRate: Number(json.lastFundingRate),
      nextFundingTime: Number(json.nextFundingTime),
    };
  } catch {
    return null;
  }
}

module.exports = { getDailyCandles, getCandles, getFundingRate, toInstId };
