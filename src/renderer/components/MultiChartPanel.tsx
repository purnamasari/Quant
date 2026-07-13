import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ColorType,
  CrosshairMode,
  createChart,
} from 'lightweight-charts';
import type {
  CandlestickData,
  IChartApi,
  ISeriesApi,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import type { ChartData, ChartRange, Quote, WatchlistItem } from '../../shared/types';
import { api } from '../api';
import '../styles/analysis.css';

const C = {
  text: '#9aa6bd',
  grid: 'rgba(32, 43, 66, 0.45)',
  up: '#1fbf75',
  down: '#f0435c',
  accent: '#4d7ef7',
} as const;

const RANGES: ChartRange[] = ['1m', '3m', '1y'];

function pct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function SimpleChart({
  data,
  compact = false,
}: {
  data: ChartData;
  compact?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const chart = createChart(host, {
      width: Math.max(host.clientWidth, 1),
      height: Math.max(host.clientHeight, 1),
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: C.text,
        fontSize: compact ? 9 : 11,
        fontFamily: "'Cascadia Mono', Consolas, ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: compact ? 'transparent' : C.grid },
        horzLines: { color: C.grid },
      },
      rightPriceScale: {
        borderColor: C.grid,
        visible: !compact,
      },
      timeScale: {
        borderColor: C.grid,
        timeVisible: data.range === '1d',
        secondsVisible: false,
        visible: !compact,
      },
      crosshair: { mode: CrosshairMode.Normal },
      handleScale: !compact,
      handleScroll: !compact,
    });

    const series = chart.addCandlestickSeries({
      upColor: C.up,
      downColor: C.down,
      wickUpColor: C.up,
      wickDownColor: C.down,
      borderVisible: false,
    });

    const observer = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1].contentRect;
      if (rect.width > 0 && rect.height > 0) {
        chart.applyOptions({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    });
    observer.observe(host);

    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;
    const candles: CandlestickData<Time>[] = data.candles.map((candle) => ({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
    series.setData(candles);
    chart.applyOptions({
      timeScale: { timeVisible: data.range === '1d', visible: !compact },
      rightPriceScale: { visible: !compact },
    });
    chart.timeScale().fitContent();
  }, [compact, data]);

  return <div ref={hostRef} className="mc-canvas" />;
}

function useChartMap(symbols: string[], range: ChartRange) {
  const [charts, setCharts] = useState<Record<string, ChartData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = `${range}|${symbols.join(',')}`;

  useEffect(() => {
    if (!symbols.length) {
      setCharts({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all(symbols.map((symbol) => api.getChart(symbol, range))).then(
      (results) => {
        if (cancelled) return;
        const next: Record<string, ChartData> = {};
        for (const chart of results) next[chart.symbol] = chart;
        setCharts(next);
        setLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Charts could not load');
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { charts, loading, error };
}

export function MultiChartPanel({
  watchlist,
  pinnedSymbols,
  quotes,
  activeSymbol,
  onSelectSymbol,
}: {
  watchlist: WatchlistItem[];
  pinnedSymbols: string[];
  quotes: Record<string, Quote>;
  activeSymbol: string | null;
  onSelectSymbol: (symbol: string) => void;
}) {
  const [mode, setMode] = useState<'single' | 'grid'>(() =>
    new URLSearchParams(window.location.search).get('smokeChartMode') === 'grid'
      ? 'grid'
      : 'single',
  );
  const [range, setRange] = useState<ChartRange>(() => {
    const smokeRange = new URLSearchParams(window.location.search).get('smokeChartRange');
    return smokeRange === '3m' || smokeRange === '1y' ? smokeRange : '1m';
  });

  const watchSymbols = useMemo(() => watchlist.map((item) => item.symbol), [watchlist]);
  const gridSymbols = useMemo(() => {
    const out: string[] = [];
    for (const symbol of [...pinnedSymbols, ...watchSymbols]) {
      if (!out.includes(symbol)) out.push(symbol);
      if (out.length >= 9) break;
    }
    return out;
  }, [pinnedSymbols, watchSymbols]);
  const selectedSymbol = activeSymbol ?? gridSymbols[0] ?? null;
  const chartSymbols = useMemo(() => {
    const out = new Set<string>();
    if (selectedSymbol) out.add(selectedSymbol);
    for (const symbol of gridSymbols) out.add(symbol);
    return [...out];
  }, [gridSymbols, selectedSymbol]);
  const { charts, loading, error } = useChartMap(chartSymbols, range);
  const selectedChart = selectedSymbol ? charts[selectedSymbol] : undefined;

  return (
    <section className="mc-panel" aria-label="Multi-chart panel">
      <div className="mc-head">
        <div>
          <h3>Multi-chart panel</h3>
          <p>Single-ticker focus or nine-pane stock chart view.</p>
        </div>
        <div className="mc-controls">
          <div className="mc-segment" role="group" aria-label="Chart layout">
            <button
              type="button"
              className={mode === 'single' ? 'is-active' : undefined}
              onClick={() => setMode('single')}
            >
              1 pane
            </button>
            <button
              type="button"
              className={mode === 'grid' ? 'is-active' : undefined}
              onClick={() => setMode('grid')}
            >
              9 panes
            </button>
          </div>
          <div className="mc-segment" role="group" aria-label="Chart range">
            {RANGES.map((item) => (
              <button
                key={item}
                type="button"
                className={range === item ? 'is-active' : undefined}
                onClick={() => setRange(item)}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="mc-error">{error}</div>}

      {mode === 'single' ? (
        <div className="mc-single">
          <div className="mc-chart-top">
            <div>
              <span className="mc-symbol num">{selectedSymbol ?? 'n/a'}</span>
              <span className="mc-name">
                {watchlist.find((item) => item.symbol === selectedSymbol)?.name ?? 'No symbol selected'}
              </span>
            </div>
            <div className="mc-quote">
              <b className="num">{money(selectedSymbol ? quotes[selectedSymbol]?.price : null)}</b>
              <span
                className={`num ${
                  (selectedSymbol ? quotes[selectedSymbol]?.changePercent : 0) &&
                  (quotes[selectedSymbol]?.changePercent ?? 0) < 0
                    ? 'down'
                    : 'up'
                }`}
              >
                {pct(selectedSymbol ? quotes[selectedSymbol]?.changePercent : null)}
              </span>
            </div>
          </div>
          <div className="mc-single-canvas">
            {selectedChart ? (
              <SimpleChart key={`${selectedChart.symbol}-${range}`} data={selectedChart} />
            ) : (
              <div className="mc-loading">{loading ? 'Loading chart...' : 'No chart data'}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="mc-grid">
          {gridSymbols.map((symbol) => {
            const quote = quotes[symbol];
            const change = quote?.changePercent;
            return (
              <button
                key={symbol}
                type="button"
                className={symbol === selectedSymbol ? 'mc-tile is-active' : 'mc-tile'}
                onClick={() => onSelectSymbol(symbol)}
              >
                <span className="mc-tile-head">
                  <b className="num">{symbol}</b>
                  <em className={`num ${(change ?? 0) < 0 ? 'down' : 'up'}`}>{pct(change)}</em>
                </span>
                <span className="mc-tile-chart">
                  {charts[symbol] ? (
                    <SimpleChart key={`${symbol}-${range}`} data={charts[symbol]} compact />
                  ) : (
                    <span className="mc-loading">{loading ? 'Loading...' : 'No data'}</span>
                  )}
                </span>
              </button>
            );
          })}
          {Array.from({ length: Math.max(0, 9 - gridSymbols.length) }, (_, index) => (
            <div key={`empty-${index}`} className="mc-tile empty">
              Add or pin a ticker
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
