// Minimal Yahoo Finance chart client (no auth needed for the public chart
// endpoint). Ported/simplified from purnamasari/quant `src/main/services/yahoo.ts`.

async function getChart(symbol, range = '1y', interval = '1d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`yahoo chart ${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`yahoo chart ${symbol}: no result (${json?.chart?.error?.description || 'unknown error'})`);
  const ts = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    const close = quote.close?.[i];
    if (close == null) continue;
    candles.push({
      time: ts[i],
      open: quote.open?.[i] ?? close,
      high: quote.high?.[i] ?? close,
      low: quote.low?.[i] ?? close,
      close,
      volume: quote.volume?.[i] ?? 0,
    });
  }
  return {
    candles,
    regularMarketPrice: result.meta?.regularMarketPrice ?? null,
  };
}

// Upcoming earnings date via the quoteSummary calendarEvents module. This
// endpoint is undocumented/unstable (same caveat as in yahoo.ts upstream);
// on failure we degrade to "unknown" rather than blocking the scan.
async function getNextEarningsDate(symbol) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=calendarEvents`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const json = await res.json();
    const earnings = json?.quoteSummary?.result?.[0]?.calendarEvents?.earnings;
    const raw = earnings?.earningsDate?.[0]?.raw;
    if (typeof raw === 'number') return new Date(raw * 1000);
    return null;
  } catch {
    return null;
  }
}

module.exports = { getChart, getNextEarningsDate };
