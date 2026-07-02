// Shared scaffolding for the center news feed and right earnings calendar:
// a keyed polling hook, time/date formatting helpers, and the small
// presentational pieces (panel header, chips, empty/error/skeleton states)
// both panels use. Styles for the cp-* classes live in styles/news.css.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { IconRefresh } from './icons';
import '../../styles/news.css';

/* ------------------------------------------------------------------ */
/* Data fetching                                                       */
/* ------------------------------------------------------------------ */

export interface PolledData<T> {
  data: T | null;
  /** foreground fetch with no data yet (or after the key changed) */
  loading: boolean;
  /** background fetch while existing data stays on screen */
  refreshing: boolean;
  error: string | null;
  updatedAt: Date | null;
  refresh: () => void;
}

interface PolledState<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  updatedAt: Date | null;
}

/**
 * Polls `fetcher` while `enabled`. Refetches (with a full skeleton reset)
 * whenever `key` — a joined symbol list — changes, avoiding effect loops
 * from fresh array identities. Manual `refresh()` and the interval keep
 * existing data visible and only spin the refresh icon.
 */
export function usePolledData<T>(
  key: string,
  enabled: boolean,
  intervalMs: number,
  fetcher: () => Promise<T>,
): PolledData<T> {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [state, setState] = useState<PolledState<T>>({
    data: null,
    loading: true,
    refreshing: false,
    error: null,
    updatedAt: null,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const [tick, setTick] = useState(0);
  const prevKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = (mode: 'reset' | 'soft') => {
      setState((s) => ({
        ...s,
        data: mode === 'reset' ? null : s.data,
        loading: mode === 'reset',
        refreshing: mode === 'soft',
        error: mode === 'reset' ? null : s.error,
      }));
      fetcherRef.current().then(
        (data) => {
          if (cancelled) return;
          setState({
            data,
            loading: false,
            refreshing: false,
            error: null,
            updatedAt: new Date(),
          });
        },
        (err: unknown) => {
          if (cancelled) return;
          const message =
            err instanceof Error ? err.message : 'Request failed';
          setState((s) => ({
            ...s,
            loading: false,
            refreshing: false,
            error: message,
          }));
        },
      );
    };

    const keyChanged =
      prevKeyRef.current !== null && prevKeyRef.current !== key;
    prevKeyRef.current = key;
    run(keyChanged || stateRef.current.data === null ? 'reset' : 'soft');

    const id = window.setInterval(() => run('soft'), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [key, enabled, intervalMs, tick]);

  const refresh = useCallback(() => {
    if (stateRef.current.loading || stateRef.current.refreshing) return;
    setTick((t) => t + 1);
  }, []);

  return { ...state, refresh };
}

/** Re-renders on a fixed cadence so relative times ("2h ago") stay fresh. */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/* ------------------------------------------------------------------ */
/* Time / date helpers                                                 */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

export function safeTime(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "12:41 PM" */
export function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "now" / "12m ago" / "2h ago" / "3d ago" */
export function relativeTime(iso: string, now: Date): string {
  const t = safeTime(iso);
  if (t === 0) return '';
  const mins = Math.floor(Math.max(0, now.getTime() - t) / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** "Mon, Jun 29" style label */
export function shortDayLabel(d: Date): string {
  return d.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Whole days from today's local midnight to `d`'s (negative = past). */
export function daysFromToday(d: Date, now: Date): number {
  return Math.round((startOfDay(d) - startOfDay(now)) / DAY_MS);
}

/** Parse "YYYY-MM-DD" as a LOCAL date (avoids UTC off-by-one). */
export function parseISODateLocal(iso: string): Date {
  const parts = iso.split('-').map(Number);
  const y = parts[0] || 1970;
  const m = parts[1] || 1;
  const d = parts[2] || 1;
  return new Date(y, m - 1, d);
}

/* ------------------------------------------------------------------ */
/* Presentational pieces                                               */
/* ------------------------------------------------------------------ */

export function PanelHeader(props: {
  title: string;
  caption: string;
  updatedAt: Date | null;
  busy: boolean;
  onRefresh: () => void;
  refreshLabel: string;
}) {
  return (
    <header className="cp-head">
      <div className="cp-head-text">
        <h2 className="cp-title">{props.title}</h2>
        <p className="cp-caption" title={props.caption}>
          {props.caption}
        </p>
      </div>
      <div className="cp-head-meta">
        {props.updatedAt && (
          <span className="cp-updated num">
            Updated {formatClock(props.updatedAt)}
          </span>
        )}
        <button
          type="button"
          className="cp-refresh"
          onClick={props.onRefresh}
          aria-label={props.refreshLabel}
          title={props.refreshLabel}
        >
          <IconRefresh
            size={14}
            className={props.busy ? 'is-spinning' : undefined}
          />
        </button>
      </div>
    </header>
  );
}

/** Amber marker for bundled/offline fallback payloads. */
export function SampleChip() {
  return (
    <span className="cp-sample" title="Bundled offline fallback data">
      SAMPLE
    </span>
  );
}

/** "via QQQ" chips mapping a holding back to the watched ETFs holding it. */
export function ViaChips({
  symbol,
  parents,
  max = 2,
}: {
  symbol: string;
  parents: Record<string, string[]>;
  max?: number;
}) {
  const list = parents[symbol];
  if (!list || list.length === 0) return null;
  const shown = list.slice(0, max);
  const extra = list.length - shown.length;
  return (
    <>
      {shown.map((etf) => (
        <span key={etf} className="cp-via" title={`Held by ${etf}`}>
          via {etf}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="cp-via"
          title={`Also held by ${list.slice(max).join(', ')}`}
        >
          +{extra}
        </span>
      )}
    </>
  );
}

/** Centered empty/error state; pass `onRetry` to render the retry button. */
export function PanelState(props: {
  icon: ReactNode;
  title: string;
  hint?: string;
  onRetry?: () => void;
  kind?: 'empty' | 'error';
}) {
  const isError = props.kind === 'error';
  return (
    <div
      className={isError ? 'cp-state is-error' : 'cp-state'}
      role={isError ? 'alert' : 'status'}
    >
      <div className="cp-state-icon">{props.icon}</div>
      <p className="cp-state-title">{props.title}</p>
      {props.hint && <p className="cp-state-hint">{props.hint}</p>}
      {props.onRetry && (
        <button type="button" className="cp-retry" onClick={props.onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/** Caption shown above skeletons while ETF holdings are still resolving. */
export function ResolvingNote() {
  return (
    <div className="cp-resolving" role="status">
      <span className="spinner" aria-hidden="true" />
      Resolving ETF holdings…
    </div>
  );
}

const SKEL_WIDTHS = [92, 68, 84, 58, 76, 88, 63, 80];

export function SkeletonList({
  variant,
  rows = 6,
}: {
  variant: 'news' | 'earnings';
  rows?: number;
}) {
  return (
    <div className="cp-skel-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => {
        const w = SKEL_WIDTHS[i % SKEL_WIDTHS.length];
        return variant === 'news' ? (
          <div key={i} className="cp-skel-row">
            <div className="skeleton cp-skel-meta" />
            <div className="skeleton cp-skel-line" style={{ width: `${w}%` }} />
            <div
              className="skeleton cp-skel-line"
              style={{ width: `${Math.max(38, w - 34)}%` }}
            />
            <div className="skeleton cp-skel-chips" />
          </div>
        ) : (
          <div key={i} className="cp-skel-row">
            <div className="cp-skel-split">
              <div className="skeleton cp-skel-sym" />
              <div
                className="skeleton cp-skel-line"
                style={{ width: `${Math.max(30, w - 40)}%` }}
              />
              <div className="skeleton cp-skel-chip" />
            </div>
            <div className="skeleton cp-skel-meta" />
          </div>
        );
      })}
    </div>
  );
}
