// Preload: exposes the QuantApi bridge on window.quant via contextBridge.
// Every method maps 1:1 to an ipcMain.handle registration in main.ts.

import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type {
  AddWatchlistResult,
  ChartData,
  ChartRange,
  EarningsEvent,
  HoldingsResult,
  NewsItem,
  PivotNewsResult,
  PivotPoint,
  QuantApi,
  Quote,
  SymbolSuggestion,
  WatchlistItem,
} from '../shared/types';

const api: QuantApi = {
  getWatchlist: (): Promise<WatchlistItem[]> => ipcRenderer.invoke(IPC.watchlistGet),
  addToWatchlist: (symbol: string): Promise<AddWatchlistResult> =>
    ipcRenderer.invoke(IPC.watchlistAdd, symbol),
  removeFromWatchlist: (symbol: string): Promise<WatchlistItem[]> =>
    ipcRenderer.invoke(IPC.watchlistRemove, symbol),
  searchSymbols: (query: string): Promise<SymbolSuggestion[]> =>
    ipcRenderer.invoke(IPC.symbolsSearch, query),
  getQuotes: (symbols: string[]): Promise<Quote[]> =>
    ipcRenderer.invoke(IPC.quotesGet, symbols),
  getHoldings: (etfSymbol: string): Promise<HoldingsResult> =>
    ipcRenderer.invoke(IPC.holdingsGet, etfSymbol),
  getNews: (symbols: string[], limitPerSymbol?: number): Promise<NewsItem[]> =>
    ipcRenderer.invoke(IPC.newsGet, symbols, limitPerSymbol),
  getEarnings: (symbols: string[]): Promise<EarningsEvent[]> =>
    ipcRenderer.invoke(IPC.earningsGet, symbols),
  getChart: (symbol: string, range: ChartRange): Promise<ChartData> =>
    ipcRenderer.invoke(IPC.chartGet, symbol, range),
  getPivotNews: (symbol: string, pivots: PivotPoint[]): Promise<PivotNewsResult[]> =>
    ipcRenderer.invoke(IPC.pivotNewsGet, symbol, pivots),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke(IPC.openExternal, url),
};

contextBridge.exposeInMainWorld('quant', api);
