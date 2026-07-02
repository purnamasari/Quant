// Symbol search box for the watchlist sidebar. Debounces 250ms into
// api.searchSymbols, renders a keyboard-navigable combobox dropdown
// (ArrowUp/Down, Enter to add, Escape to close), and adds symbols through
// actions.addSymbol — surfacing failures inline under the input for 3s.

import '../../styles/watchlist.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SymbolSuggestion } from '../../../shared/types';
import { api } from '../../api';
import { useApp } from '../../store';

const DEBOUNCE_MS = 250;
const NOTICE_TTL_MS = 3000;

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4-4" />
    </svg>
  );
}

export function AddSymbol() {
  const { state, actions } = useApp();
  const [value, setValue] = useState('');
  const [results, setResults] = useState<SymbolSuggestion[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const seqRef = useRef(0);
  const noticeTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const watched = useMemo(
    () => new Set(state.watchlist.map((i) => i.symbol)),
    [state.watchlist],
  );

  const query = value.trim();

  // Debounced search. The sequence counter invalidates both pending timers
  // and in-flight IPC responses whenever the query changes.
  useEffect(() => {
    seqRef.current += 1;
    const seq = seqRef.current;
    if (!query) {
      setResults(null);
      setSearching(false);
      setSearchFailed(false);
      setOpen(false);
      return;
    }
    setSearching(true);
    setSearchFailed(false);
    const timer = window.setTimeout(() => {
      api.searchSymbols(query).then(
        (list) => {
          if (seqRef.current !== seq) return;
          setResults(list);
          setSearching(false);
          setActive(0);
          setOpen(true);
        },
        () => {
          if (seqRef.current !== seq) return;
          setResults(null);
          setSearching(false);
          setSearchFailed(true);
          setOpen(true);
        },
      );
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, retryTick]);

  useEffect(
    () => () => {
      if (noticeTimer.current != null) window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current != null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), NOTICE_TTL_MS);
  }, []);

  const addSymbol = useCallback(
    async (rawSymbol: string) => {
      const symbol = rawSymbol.trim().toUpperCase();
      if (!symbol || adding) return;
      if (watched.has(symbol)) {
        showNotice(`${symbol} is already on your watchlist`);
        return;
      }
      setAdding(true);
      const result = await actions
        .addSymbol(symbol)
        .catch(() => ({ ok: false, error: 'Could not add symbol' }));
      setAdding(false);
      if (result.ok) {
        setValue('');
        setResults(null);
        setSearchFailed(false);
        setOpen(false);
        inputRef.current?.focus();
      } else {
        showNotice(result.error ?? `Could not add ${symbol}`);
      }
    },
    [actions, adding, watched, showNotice],
  );

  const suggestions = results ?? [];
  const canNavigate = open && suggestions.length > 0;
  const activeSuggestion = canNavigate ? suggestions[active] : undefined;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open && results !== null && results.length > 0) {
          setOpen(true);
        } else if (canNavigate) {
          setActive((i) => (i + 1) % suggestions.length);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (canNavigate) {
          setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (activeSuggestion) {
          void addSymbol(activeSuggestion.symbol);
        } else if (query && (searchFailed || (open && suggestions.length === 0))) {
          // Search unavailable or no matches — let the user try the raw
          // ticker; the main process validates it.
          void addSymbol(query);
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          setOpen(false);
        } else if (value) {
          setValue('');
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className="wl-add">
      <div className="wl-add-box">
        <span className="wl-add-icon">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          className="wl-add-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="wl-add-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            activeSuggestion ? `wl-opt-${activeSuggestion.symbol}` : undefined
          }
          aria-label="Add symbol to watchlist"
          placeholder="Add symbol…"
          spellCheck={false}
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (query && (results !== null || searchFailed)) setOpen(true);
          }}
          onBlur={() => setOpen(false)}
        />
        {(searching || adding) && (
          <span className="wl-add-spinner spinner" aria-hidden="true" />
        )}

        {open && (
          // Prevent mousedown inside the dropdown from blurring the input,
          // so option clicks and the retry button work.
          <div className="wl-add-pop" onMouseDown={(e) => e.preventDefault()}>
            {searchFailed ? (
              <div className="wl-add-state" role="alert">
                <span>Search failed. Check your connection.</span>
                <button
                  type="button"
                  className="wl-retry"
                  onClick={() => setRetryTick((n) => n + 1)}
                >
                  Retry
                </button>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="wl-add-state">
                <span>No matches for “{query}”</span>
              </div>
            ) : (
              <ul
                className="wl-add-list"
                id="wl-add-listbox"
                role="listbox"
                aria-label="Symbol suggestions"
              >
                {suggestions.map((s, i) => {
                  const isWatched = watched.has(s.symbol);
                  return (
                    <li
                      key={`${s.symbol}-${s.type}`}
                      id={`wl-opt-${s.symbol}`}
                      role="option"
                      aria-selected={i === active}
                      className={`wl-opt${i === active ? ' active' : ''}${
                        isWatched ? ' watched' : ''
                      }`}
                      title={s.exchange ? `${s.name} — ${s.exchange}` : s.name}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => void addSymbol(s.symbol)}
                    >
                      <span className="wl-opt-sym num">{s.symbol}</span>
                      <span className="wl-opt-name">{s.name}</span>
                      {isWatched && <span className="wl-opt-added">Added</span>}
                      <span className={`wl-opt-badge ${s.type}`}>
                        {s.type === 'etf' ? 'ETF' : 'Stock'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {notice && (
        <div className="wl-add-notice" role="alert">
          {notice}
        </div>
      )}
    </div>
  );
}
