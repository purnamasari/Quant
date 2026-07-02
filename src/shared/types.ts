// Shared contract between the Electron main process and the renderer.
// This file is the single source of truth for data shapes and the
// window.quant bridge API. Breaking changes here require coordinated
// updates to src/main/preload.ts, the IPC handlers in src/main, and
// every renderer caller.

export type InstrumentType = 'etf' | 'stock';

/** Where a payload came from. 'sample' means bundled/offline fallback data —
 *  the UI must surface this so the user is never misled by stale numbers. */
export type DataSource = 'live' | 'sample';

export interface WatchlistItem {
  symbol: string;
  name: string;
  type: InstrumentType;
  addedAt: string; // ISO timestamp
}

export interface SymbolSuggestion {
  symbol: string;
  name: string;
  type: InstrumentType;
  exchange?: string;
}

export interface Quote {
  symbol: string;
  price: number | null;
  change: number | null;         // absolute change vs previous close
  changePercent: number | null;  // -1.23 means -1.23%
  previousClose: number | null;
  currency: string;
  marketState?: string;
  updatedAt: string; // ISO
  source: DataSource;
}

export interface Holding {
  symbol: string;
  name: string;
  weightPercent: number | null; // 0..100
}

export interface HoldingsResult {
  etfSymbol: string;
  asOf: string;        // date the holdings snapshot represents (YYYY-MM-DD or YYYY-MM)
  holdings: Holding[]; // up to top 20, sorted by weight desc
  source: DataSource;  // 'live' if fetched, 'sample' if from the bundled dataset
}

export interface NewsItem {
  id: string;            // stable id for dedupe + React keys
  title: string;
  url: string;
  sourceName: string;    // publisher, e.g. "Reuters"
  publishedAt: string;   // ISO
  relatedSymbol: string; // ticker this article was fetched for
  summary?: string;
}

export type EarningsTime = 'bmo' | 'amc' | 'unknown'; // before market open / after market close

export interface EarningsEvent {
  symbol: string;
  companyName: string;
  date: string;          // ISO date, YYYY-MM-DD
  time: EarningsTime;
  epsEstimate: number | null;
  source: DataSource;
}

export type ChartRange = '1d' | '1w' | '1m' | '6m' | '1y' | '5y' | 'max';
export const CHART_RANGES: ChartRange[] = ['1d', '1w', '1m', '6m', '1y', '5y', 'max'];

export interface Candle {
  time: number; // unix seconds, UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartData {
  symbol: string;
  range: ChartRange;
  interval: string; // e.g. "5m", "1d", "1wk"
  candles: Candle[]; // ascending by time, no null closes
  currency: string;
  exchangeName?: string;
  regularMarketPrice?: number | null;
  previousClose?: number | null;
  source: DataSource;
}

/** A significant local high or low detected in the candle series. */
export interface PivotPoint {
  time: number;  // unix seconds — time of the pivot candle
  price: number; // the candle's high for 'high' pivots, low for 'low'
  kind: 'high' | 'low';
}

export interface PivotNewsResult {
  pivot: PivotPoint;
  items: NewsItem[]; // news published near the pivot date; may be empty
}

export type AddWatchlistResult =
  | { ok: true; item: WatchlistItem; watchlist: WatchlistItem[] }
  | { ok: false; error: string };

/** The API exposed on window.quant by src/main/preload.ts. */
export interface QuantApi {
  getWatchlist(): Promise<WatchlistItem[]>;
  addToWatchlist(symbol: string): Promise<AddWatchlistResult>;
  removeFromWatchlist(symbol: string): Promise<WatchlistItem[]>;
  searchSymbols(query: string): Promise<SymbolSuggestion[]>;
  getQuotes(symbols: string[]): Promise<Quote[]>;
  getHoldings(etfSymbol: string): Promise<HoldingsResult>;
  getNews(symbols: string[], limitPerSymbol?: number): Promise<NewsItem[]>;
  getEarnings(symbols: string[]): Promise<EarningsEvent[]>;
  getChart(symbol: string, range: ChartRange): Promise<ChartData>;
  getPivotNews(symbol: string, pivots: PivotPoint[]): Promise<PivotNewsResult[]>;
  openExternal(url: string): Promise<void>;
}
