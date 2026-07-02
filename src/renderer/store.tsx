// Global app state: watchlist, quotes, ETF holdings, news filter, and the
// chart-modal target. Components read via useApp()/useFocusSymbols() and
// mutate only through the provided actions.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import type { HoldingsResult, Quote, WatchlistItem } from '../shared/types';
import { api } from './api';

export interface AppState {
  watchlist: WatchlistItem[];
  watchlistLoaded: boolean;
  quotes: Record<string, Quote>;
  holdings: Record<string, HoldingsResult>; // keyed by ETF symbol
  newsFilter: string; // 'all' or a watchlist symbol
  modalSymbol: string | null;
}

type Action =
  | { type: 'watchlist'; items: WatchlistItem[] }
  | { type: 'quotes'; quotes: Quote[] }
  | { type: 'holdings'; result: HoldingsResult }
  | { type: 'newsFilter'; value: string }
  | { type: 'openChart'; symbol: string }
  | { type: 'closeChart' };

const initialState: AppState = {
  watchlist: [],
  watchlistLoaded: false,
  quotes: {},
  holdings: {},
  newsFilter: 'all',
  modalSymbol: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'watchlist': {
      const symbols = new Set(action.items.map((i) => i.symbol));
      return {
        ...state,
        watchlist: action.items,
        watchlistLoaded: true,
        newsFilter:
          state.newsFilter !== 'all' && !symbols.has(state.newsFilter)
            ? 'all'
            : state.newsFilter,
      };
    }
    case 'quotes': {
      const next = { ...state.quotes };
      for (const q of action.quotes) next[q.symbol] = q;
      return { ...state, quotes: next };
    }
    case 'holdings':
      return {
        ...state,
        holdings: { ...state.holdings, [action.result.etfSymbol]: action.result },
      };
    case 'newsFilter':
      return { ...state, newsFilter: action.value };
    case 'openChart':
      return { ...state, modalSymbol: action.symbol };
    case 'closeChart':
      return { ...state, modalSymbol: null };
  }
}

export interface AppActions {
  addSymbol(symbol: string): Promise<{ ok: boolean; error?: string }>;
  removeSymbol(symbol: string): Promise<void>;
  setNewsFilter(value: string): void;
  openChart(symbol: string): void;
  closeChart(): void;
  refreshQuotes(): Promise<void>;
}

interface AppContextValue {
  state: AppState;
  actions: AppActions;
}

const AppContext = createContext<AppContextValue | null>(null);

const QUOTE_REFRESH_MS = 45_000;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Initial watchlist load. The main process never intentionally rejects this
  // channel, but if the IPC call itself fails we retry with capped backoff so
  // the sidebar cannot get stuck on its skeleton state forever.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const load = (attempt: number) => {
      api.getWatchlist().then(
        (items) => {
          if (!cancelled) dispatch({ type: 'watchlist', items });
        },
        () => {
          if (cancelled) return;
          const delay = Math.min(15_000, 1_000 * 2 ** attempt);
          timer = window.setTimeout(() => load(attempt + 1), delay);
        },
      );
    };
    load(0);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  // Smoke-test hook: main can launch us with ?smokeModal=SPY to exercise the
  // chart modal in automated screenshot runs.
  useEffect(() => {
    const sym = new URLSearchParams(window.location.search).get('smokeModal');
    if (!sym) return;
    const t = setTimeout(
      () => dispatch({ type: 'openChart', symbol: sym.toUpperCase() }),
      2500,
    );
    return () => clearTimeout(t);
  }, []);

  const watchlistKey = state.watchlist.map((i) => i.symbol).join(',');

  const refreshQuotes = useCallback(async () => {
    const symbols = watchlistKey ? watchlistKey.split(',') : [];
    if (symbols.length === 0) return;
    const quotes = await api.getQuotes(symbols).catch(() => [] as Quote[]);
    if (quotes.length) dispatch({ type: 'quotes', quotes });
  }, [watchlistKey]);

  useEffect(() => {
    if (!state.watchlistLoaded) return;
    void refreshQuotes();
    const id = setInterval(() => void refreshQuotes(), QUOTE_REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshQuotes, state.watchlistLoaded]);

  // Load top-20 holdings for every ETF on the watchlist (once per ETF).
  // The main process falls back to bundled sample holdings rather than
  // rejecting, but if the IPC call itself fails we retry with capped backoff
  // so useFocusSymbols cannot report ready=false forever.
  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const fetchHoldings = (symbol: string, attempt: number) => {
      api.getHoldings(symbol).then(
        (result) => {
          if (!cancelled) dispatch({ type: 'holdings', result });
        },
        () => {
          if (cancelled) return;
          const delay = Math.min(30_000, 2_000 * 2 ** attempt);
          timers.push(
            window.setTimeout(() => fetchHoldings(symbol, attempt + 1), delay),
          );
        },
      );
    };
    for (const item of state.watchlist) {
      if (item.type !== 'etf' || state.holdings[item.symbol]) continue;
      fetchHoldings(item.symbol, 0);
    }
    return () => {
      cancelled = true;
      for (const t of timers) window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistKey]);

  const actions = useMemo<AppActions>(
    () => ({
      async addSymbol(symbol: string) {
        const result = await api.addToWatchlist(symbol.trim().toUpperCase());
        if (result.ok) {
          dispatch({ type: 'watchlist', items: result.watchlist });
          return { ok: true };
        }
        return { ok: false, error: result.error };
      },
      async removeSymbol(symbol: string) {
        const items = await api.removeFromWatchlist(symbol);
        dispatch({ type: 'watchlist', items });
      },
      setNewsFilter(value: string) {
        dispatch({ type: 'newsFilter', value });
      },
      openChart(symbol: string) {
        dispatch({ type: 'openChart', symbol });
      },
      closeChart() {
        dispatch({ type: 'closeChart' });
      },
      refreshQuotes,
    }),
    [refreshQuotes],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

/** The set of tickers the center panels care about for the current filter:
 *  watched stocks themselves plus the top-20 holdings of watched ETFs. */
export interface FocusSymbols {
  symbols: string[];
  /** holding symbol -> ETF symbols that contain it (for "via QQQ" badges) */
  parents: Record<string, string[]>;
  /** false while any relevant ETF's holdings are still loading */
  ready: boolean;
}

export function useFocusSymbols(filterOverride?: string): FocusSymbols {
  const { state } = useApp();
  const filter = filterOverride ?? state.newsFilter;
  return useMemo(() => {
    const items =
      filter === 'all'
        ? state.watchlist
        : state.watchlist.filter((i) => i.symbol === filter);
    const symbols: string[] = [];
    const parents: Record<string, string[]> = {};
    let ready = state.watchlistLoaded;
    const push = (s: string, parent?: string) => {
      if (!symbols.includes(s)) symbols.push(s);
      if (parent) {
        const list = (parents[s] = parents[s] ?? []);
        if (!list.includes(parent)) list.push(parent);
      }
    };
    for (const item of items) {
      if (item.type === 'stock') {
        push(item.symbol);
      } else {
        const h = state.holdings[item.symbol];
        if (!h) {
          ready = false;
          continue;
        }
        for (const holding of h.holdings.slice(0, 20)) push(holding.symbol, item.symbol);
      }
    }
    return { symbols, parents, ready };
  }, [state.watchlist, state.holdings, state.watchlistLoaded, filter]);
}
