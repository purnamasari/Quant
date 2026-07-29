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

function toInstId(symbol) {
  // accept "BTCUSDT" or "BTC-USDT" or "BTC-USDT-SWAP"
  if (symbol.includes('-')) return symbol;
  const quote = symbol.endsWith('USDT') ? 'USDT' : symbol.slice(-3);
  const base = symbol.slice(0, symbol.length - quote.length);
  return `${base}-${quote}`;
}

async function getDailyCandles(symbol, days = 300) {
  const instId = toInstId(symbol);
  const candles = [];
  let after = undefined;
  const limit = 100;
  while (candles.length < days) {
    const url = new URL(`${BASE}/api/v5/market/${after ? 'history-candles' : 'candles'}`);
    url.searchParams.set('instId', instId);
    url.searchParams.set('bar', '1D');
    url.searchParams.set('limit', String(Math.min(limit, days - candles.length + limit)));
    if (after) url.searchParams.set('after', after);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`okx candles ${instId}: HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== '0') throw new Error(`okx candles ${instId}: ${json.msg}`);
    const rows = json.data || [];
    if (!rows.length) break;
    // OKX returns newest-first: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
    // confirm=0 means today's candle is still forming (not closed yet) —
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
  }
  // sort ascending by time (OKX gives newest-first)
  candles.sort((a, b) => a.time - b.time);
  return candles.slice(-days);
}

async function getFundingRate(symbol) {
  const base = toInstId(symbol).replace('-SWAP', '');
  const instId = `${base}-SWAP`;
  const res = await fetch(`${BASE}/api/v5/public/funding-rate?instId=${instId}`);
  if (!res.ok) return null;
  const json = await res.json();
  const row = json?.data?.[0];
  if (!row) return null;
  return {
    instId,
    fundingRate: Number(row.fundingRate),
    nextFundingTime: Number(row.nextFundingTime),
  };
}

module.exports = { getDailyCandles, getFundingRate, toInstId };
