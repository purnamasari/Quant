// symbols:search — Yahoo symbol search mapped to SymbolSuggestion[], with an
// offline fallback that filters the bundled symbol directory.

import type { InstrumentType, SymbolSuggestion } from '../../shared/types';
import { getSymbolDirectory } from './dataFiles';
import { searchYahoo } from './yahoo';

const MAX_RESULTS = 8;

function mapQuoteType(quoteType: string | undefined): InstrumentType | null {
  const t = (quoteType ?? '').toUpperCase();
  if (t === 'ETF') return 'etf';
  if (t === 'EQUITY') return 'stock';
  return null;
}

/** Filter the bundled directory: exact symbol, then symbol prefix, then name. */
export function searchDirectory(query: string): SymbolSuggestion[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const qLower = query.trim().toLowerCase();
  const dir = getSymbolDirectory();

  const scored = dir
    .map((entry) => {
      let score = -1;
      if (entry.symbol === q) score = 3;
      else if (entry.symbol.startsWith(q)) score = 2;
      else if (entry.name.toLowerCase().includes(qLower)) score = 1;
      return { entry, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.symbol.localeCompare(b.entry.symbol));

  return scored.slice(0, MAX_RESULTS).map(({ entry }) => ({
    symbol: entry.symbol,
    name: entry.name,
    type: entry.type,
    exchange: entry.exchange,
  }));
}

export async function searchSymbols(query: string): Promise<SymbolSuggestion[]> {
  const q = query.trim().slice(0, 48);
  if (!q) return [];
  try {
    const quotes = await searchYahoo(q);
    const out: SymbolSuggestion[] = [];
    for (const quote of quotes) {
      const type = mapQuoteType(quote.quoteType);
      if (!type) continue;
      const symbol = typeof quote.symbol === 'string' ? quote.symbol.toUpperCase() : '';
      if (!symbol || out.some((s) => s.symbol === symbol)) continue;
      out.push({
        symbol,
        name: quote.longname || quote.shortname || symbol,
        type,
        exchange: quote.exchDisp || undefined,
      });
      if (out.length >= MAX_RESULTS) break;
    }
    // Live search can legitimately return nothing; only fall back to the
    // offline directory when Yahoo gave us nothing usable at all.
    return out.length > 0 ? out : searchDirectory(q);
  } catch {
    return searchDirectory(q);
  }
}
