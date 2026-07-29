// OKX public market-data client. NOTE: Binance itself (both spot
// api.binance.com and futures fapi.binance.com) returned HTTP 451
// "restricted location" from this environment's network, and Bybit
// returned a CloudFront country block (403). OKX and Kraken/Coinbase were
// the reachable venues tested. Since the daily job runs from this same
// environment, OKX is used as the live data source even though the user's
// actual trading venue is Binance perpetuals — prices for top pairs
// (BTC/ETH/majors) track closely across venues via arbitrage, but this is
// a real substitution, not Binance data. If this is later self-hosted
// somewhere with Binance access, swap this module for a Binance client and
// the signal/backtest code above it does not need to change.

const BASE = 'https://www.okx.com';

// Transient-failure retry. Observed in practice: whole scans failing 12/12
// with HTTP 503 whose body reads "DNS resolution failure" — that text comes
// from the network path in front of us, not from OKX, and direct requests to
// the same URLs succeed seconds later. Two such episodes occurred in one day,
// each clearing within a couple of minutes.
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

function toInstId(symbol) {
  // accept "BTCUSDT" or "BTC-USDT" or "BTC-USDT-SWAP"
  if (symbol.includes('-')) return symbol;
  const quote = symbol.endsWith('USDT') ? 'USDT' : symbol.slice(-3);
  const base = symbol.slice(0, symbol.length - quote.length);
  return `${base}-${quote}`;
}

async function getCandles(symbol, bar, count, { pauseMs = 0 } = {}) {
  const instId = toInstId(symbol);
  const candles = [];
  let after = undefined;
  const limit = 100;
  while (candles.length < count) {
    const url = new URL(`${BASE}/api/v5/market/${after ? 'history-candles' : 'candles'}`);
    url.searchParams.set('instId', instId);
    url.searchParams.set('bar', bar);
    url.searchParams.set('limit', String(Math.min(limit, count - candles.length + limit)));
    if (after) url.searchParams.set('after', after);
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error(`okx candles ${instId}: HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== '0') throw new Error(`okx candles ${instId}: ${json.msg}`);
    const rows = json.data || [];
    if (!rows.length) break;
    // OKX returns newest-first: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
    // confirm=0 means the latest candle is still forming (not closed yet) —
    // matters when scanning intraday, since our signal thresholds were
    // backtested against closed candles only. See cryptoJob.js.
    for (const row of rows) {
      candles.push({
        time: Math.floor(Number(row[0]) / 1000),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
        confirmed: row[8] === '1',
      });
    }
    after = rows[rows.length - 1][0];
    if (rows.length < limit) break;
    if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
  }
  // sort ascending by time (OKX gives newest-first)
  candles.sort((a, b) => a.time - b.time);
  return candles.slice(-count);
}

async function getDailyCandles(symbol, days = 300) {
  return getCandles(symbol, '1D', days);
}

async function getFundingRate(symbol) {
  const base = toInstId(symbol).replace('-SWAP', '');
  const instId = `${base}-SWAP`;
  const res = await fetchWithRetry(`${BASE}/api/v5/public/funding-rate?instId=${instId}`).catch(() => null);
  if (!res || !res.ok) return null;
  const json = await res.json();
  const row = json?.data?.[0];
  if (!row) return null;
  return {
    instId,
    fundingRate: Number(row.fundingRate),
    nextFundingTime: Number(row.nextFundingTime),
  };
}

module.exports = { getDailyCandles, getCandles, getFundingRate, toInstId };
