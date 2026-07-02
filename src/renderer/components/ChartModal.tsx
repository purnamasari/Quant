// ChartModal — the app's centerpiece. Webull-style candlestick chart with
// volume, auto-detected pivots, projected support/resistance, and an async
// right-hand panel that fetches news around each pivot AFTER the chart has
// rendered. Remounted per symbol via key={symbol} in App.tsx.

import '../styles/chart-modal.css';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CHART_RANGES } from '../../shared/types';
import type { ChartRange } from '../../shared/types';
import { useApp } from '../store';
import { ChartCanvas } from './chart/ChartCanvas';
import type { ChartCanvasHandle } from './chart/ChartCanvas';
import { PivotNewsPanel } from './chart/PivotNewsPanel';
import { computeTrendLines, findPivots } from './chart/analysis';
import type { TrendLines } from './chart/analysis';
import { useChartData } from './chart/useChartData';
import { usePivotNews } from './chart/usePivotNews';
import {
  formatPrice,
  formatSigned,
  formatSignedPercent,
  isIntradayRange,
} from './chart/format';

const DEFAULT_RANGE: ChartRange = '1y';
const EMPTY_LINES: TrendLines = { support: [], resistance: [] };

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2.5l6 10.5H2L8 2.5z" />
      <path d="M8 7v3M8 12.2v.01" />
    </svg>
  );
}

export function ChartModal({ symbol }: { symbol: string }) {
  const { state, actions } = useApp();
  const [range, setRange] = useState<ChartRange>(DEFAULT_RANGE);
  const [highlight, setHighlight] = useState<number | null>(null);
  const canvasRef = useRef<ChartCanvasHandle | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const { data, loading, error, generation, retry } = useChartData(symbol, range);

  const pivots = useMemo(
    () => (data && data.candles.length > 0 ? findPivots(data.candles) : []),
    [data],
  );
  const trendLines = useMemo(
    () =>
      data && pivots.length > 0
        ? computeTrendLines(data.candles, pivots)
        : EMPTY_LINES,
    [data, pivots],
  );
  const { groups, pending } = usePivotNews(symbol, range, pivots, generation);

  // A pivot's marker gains its number once its news arrived non-empty.
  const numbered = useMemo(
    () => groups.map((g) => g.status === 'done' && g.items.length > 0),
    [groups],
  );

  // New generation (range switch / retry) → any panel-hover highlight is stale.
  useEffect(() => setHighlight(null), [generation]);

  // ✕ takes focus on mount; Escape closes from anywhere.
  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') actions.closeChart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);

  // Minimal focus trap: Tab wraps within the dialog.
  const trapTab = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const handleHoverPivot = useCallback((i: number | null) => setHighlight(i), []);
  const handleSelectPivot = useCallback((i: number) => {
    canvasRef.current?.scrollToPivot(i);
  }, []);

  // ---- Header quote: live quote first, chart meta as fallback ----
  const watchItem = state.watchlist.find((w) => w.symbol === symbol);
  const quote = state.quotes[symbol];
  const price = quote?.price ?? data?.regularMarketPrice ?? null;
  let change = quote?.change ?? null;
  let changePercent = quote?.changePercent ?? null;
  if (change === null && price !== null) {
    const prev = quote?.previousClose ?? data?.previousClose ?? null;
    if (prev !== null) {
      change = price - prev;
      changePercent = prev !== 0 ? (change / prev) * 100 : null;
    }
  }
  const direction = change === null ? '' : change >= 0 ? 'up' : 'down';

  const empty = !loading && !error && data !== null && data.candles.length === 0;

  return (
    <div
      className="cm-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) actions.closeChart();
      }}
    >
      <div
        ref={panelRef}
        className="cm-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${symbol} chart`}
        onKeyDown={trapTab}
      >
        <header className="cm-header">
          <div className="cm-ident">
            <span className="cm-symbol num">{symbol}</span>
            {watchItem && (
              <span className="cm-name" title={watchItem.name}>
                {watchItem.name}
              </span>
            )}
          </div>
          {price !== null && (
            <div className="cm-quote">
              <span className="cm-price num">{formatPrice(price)}</span>
              {change !== null && (
                <span className={`cm-chip num ${direction}`}>
                  {formatSigned(change)}
                  {changePercent !== null
                    ? ` (${formatSignedPercent(changePercent)})`
                    : ''}
                </span>
              )}
            </div>
          )}
          {data &&
            (data.source === 'sample' ? (
              <span className="cm-src sample" title="Bundled offline fallback data">
                SAMPLE
              </span>
            ) : (
              <span className="cm-src live" title="Live market data">
                <span className="cm-live-dot" aria-hidden="true" />
                LIVE
              </span>
            ))}
          <div className="cm-ranges" role="group" aria-label="Chart range">
            {CHART_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={r === range}
                onClick={() => setRange(r)}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="cm-close"
            onClick={() => actions.closeChart()}
            aria-label="Close chart"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="cm-body">
          <div className="cm-chart-area">
            {data && data.candles.length > 0 && (
              <ChartCanvas
                ref={canvasRef}
                data={data}
                pivots={pivots}
                trendLines={trendLines}
                numbered={numbered}
                highlight={highlight}
              />
            )}
            {loading && (
              <div className="cm-overlay">
                <span
                  className="spinner"
                  role="status"
                  aria-label="Loading chart"
                />
              </div>
            )}
            {!loading && error !== null && (
              <div className="cm-overlay">
                <div className="cm-state" role="alert">
                  <AlertIcon />
                  <p>Couldn't load this chart.</p>
                  <p className="cm-state-detail">{error}</p>
                  <button type="button" className="cm-btn" onClick={retry}>
                    Retry
                  </button>
                </div>
              </div>
            )}
            {empty && (
              <div className="cm-overlay">
                <div className="cm-state">
                  <p>No data for this range.</p>
                  <p className="cm-state-detail">
                    Try a different range from the toggle above.
                  </p>
                </div>
              </div>
            )}
          </div>
          <PivotNewsPanel
            groups={groups}
            pending={pending}
            chartLoading={loading}
            chartFailed={error !== null || empty}
            pivotCount={pivots.length}
            intraday={isIntradayRange(range)}
            onHoverPivot={handleHoverPivot}
            onSelectPivot={handleSelectPivot}
          />
        </div>
      </div>
    </div>
  );
}
