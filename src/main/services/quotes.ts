// quotes:get — live quotes derived from the v8 chart endpoint (1d/5m),
// which needs no auth. One Quote is always returned per requested symbol;
// per-symbol failures fall back to deterministic sample quotes.

import type { Quote } from '../../shared/types';
import { sampleQuote } from './sample';
import { pLimit, round2 } from './util';
import { fetchYahooChart } from './yahoo';

const QUOTE_TTL_MS = 45_000;
const limit = pLimit(4);

async function fetchQuote(symbol: string): Promise<Quote> {
  const result = await fetchYahooChart(symbol, '1d', '5m', QUOTE_TTL_MS);
  const meta = result.meta ?? {};

  const price =
    typeof meta.regularMarketPrice === 'number' && Number.isFinite(meta.regularMarketPrice)
      ? meta.regularMarketPrice
      : null;
  const prevRaw = meta.chartPreviousClose ?? meta.previousClose;
  const previousClose =
    typeof prevRaw === 'number' && Number.isFinite(prevRaw) ? prevRaw : null;

  let change: number | null = null;
  let changePercent: number | null = null;
  if (price !== null && previousClose !== null) {
    change = round2(price - previousClose);
    changePercent = previousClose !== 0 ? round2((change / previousClose) * 100) : null;
  }

  return {
    symbol,
    price,
    change,
    changePercent,
    previousClose,
    currency: typeof meta.currency === 'string' && meta.currency ? meta.currency : 'USD',
    marketState:
      typeof meta.marketState === 'string' && meta.marketState ? meta.marketState : undefined,
    updatedAt: new Date().toISOString(),
    source: 'live',
  };
}

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  return Promise.all(
    symbols.map((symbol) =>
      limit(() => fetchQuote(symbol)).catch(() => sampleQuote(symbol)),
    ),
  );
}
