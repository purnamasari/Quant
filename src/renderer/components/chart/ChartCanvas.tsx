// lightweight-charts (v4 API) wrapper: candlesticks + volume histogram,
// dashed support/resistance rays, pivot arrow markers, and a crosshair OHLC
// legend. The chart instance is created once per mount; data/markers/lines
// are pushed through effects so range switches reuse the same canvas.
//
// Canvas colours cannot read CSS variables, so the hexes below are hardcoded
// mirrors of src/renderer/styles/tokens.css — KEEP THEM IN SYNC:
//   text #9aa6bd (--text-2)   grid rgba(32,43,66,0.5) (--border @50%)
//   up   #1fbf75 (--up)       down #f0435c (--down)
//   accent #4d7ef7 (--accent) warn #e8a33d (--warn)
//   crosshair label #1b2438 (--surface-3)

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
} from 'lightweight-charts';
import type {
  CandlestickData,
  HistogramData,
  IChartApi,
  ISeriesApi,
  LineData,
  MouseEventParams,
  SeriesMarker,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import type { ChartData, PivotPoint } from '../../../shared/types';
import type { TrendLines } from './analysis';
import {
  formatCandleTime,
  formatPrice,
  formatSigned,
  formatSignedPercent,
  formatVolume,
  isIntradayRange,
} from './format';

const C = {
  text: '#9aa6bd',
  grid: 'rgba(32, 43, 66, 0.5)',
  up: '#1fbf75',
  down: '#f0435c',
  upDim: '#1fbf7566', // --up at ~40% alpha for volume bars
  downDim: '#f0435c66', // --down at ~40% alpha for volume bars
  accent: '#4d7ef7',
  warn: '#e8a33d',
  crosshair: 'rgba(154, 166, 189, 0.45)',
  crosshairLabel: '#1b2438',
} as const;

export interface ChartCanvasHandle {
  /** Best-effort: centre the visible range on the given pivot (by index). */
  scrollToPivot(index: number): void;
}

interface ChartCanvasProps {
  data: ChartData;
  pivots: PivotPoint[];
  trendLines: TrendLines;
  /** pivot index → true once its news arrived non-empty; marker gets the
   *  1-based number as a text label so it matches the panel badge. */
  numbered: boolean[];
  /** pivot index currently hovered in the news panel (accent marker). */
  highlight: number | null;
}

export const ChartCanvas = forwardRef<ChartCanvasHandle, ChartCanvasProps>(
  function ChartCanvas({ data, pivots, trendLines, numbered, highlight }, ref) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const supportSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const resistSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const indexByTimeRef = useRef<Map<number, number>>(new Map());
    const hoverTimeRef = useRef<number | null>(null);
    const [hoverTime, setHoverTime] = useState<number | null>(null);

    const indexByTime = useMemo(() => {
      const map = new Map<number, number>();
      for (let i = 0; i < data.candles.length; i++) map.set(data.candles[i].time, i);
      return map;
    }, [data]);

    // ---- Chart lifecycle: create once, tear down fully on unmount ----
    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const chart = createChart(host, {
        width: Math.max(host.clientWidth, 1),
        height: Math.max(host.clientHeight, 1),
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: C.text,
          fontSize: 11,
          fontFamily: "'Cascadia Mono', Consolas, ui-monospace, monospace",
        },
        grid: {
          vertLines: { color: C.grid },
          horzLines: { color: C.grid },
        },
        rightPriceScale: { borderColor: C.grid },
        timeScale: {
          borderColor: C.grid,
          rightOffset: 4,
          timeVisible: isIntradayRange(data.range),
          secondsVisible: false,
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: C.crosshair, labelBackgroundColor: C.crosshairLabel },
          horzLine: { color: C.crosshair, labelBackgroundColor: C.crosshairLabel },
        },
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: C.up,
        downColor: C.down,
        wickUpColor: C.up,
        wickDownColor: C.down,
        borderVisible: false,
      });

      const volumeSeries = chart.addHistogramSeries({
        priceScaleId: '', // overlay scale pinned to the bottom fifth
        priceFormat: { type: 'volume' },
        priceLineVisible: false,
        lastValueVisible: false,
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      const trendOptions = (color: string) =>
        ({
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          // Projected rays must not stretch the price scale.
          autoscaleInfoProvider: () => null,
        }) as const;
      const supportSeries = chart.addLineSeries(trendOptions(C.up));
      const resistSeries = chart.addLineSeries(trendOptions(C.down));

      const onCrosshairMove = (param: MouseEventParams<Time>) => {
        const t = typeof param.time === 'number' ? param.time : null;
        if (t === hoverTimeRef.current) return;
        hoverTimeRef.current = t;
        setHoverTime(t);
      };
      chart.subscribeCrosshairMove(onCrosshairMove);

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
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;
      supportSeriesRef.current = supportSeries;
      resistSeriesRef.current = resistSeries;

      return () => {
        observer.disconnect();
        chart.unsubscribeCrosshairMove(onCrosshairMove);
        chart.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
        supportSeriesRef.current = null;
        resistSeriesRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- Candles + volume (order matters: before markers/trend effects) ----
    useEffect(() => {
      const chart = chartRef.current;
      const candleSeries = candleSeriesRef.current;
      const volumeSeries = volumeSeriesRef.current;
      if (!chart || !candleSeries || !volumeSeries) return;

      indexByTimeRef.current = indexByTime;

      const candleData: CandlestickData<Time>[] = data.candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      candleSeries.setData(candleData);

      const volumeData: HistogramData<Time>[] = data.candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? C.upDim : C.downDim,
      }));
      volumeSeries.setData(volumeData);

      chart.applyOptions({
        timeScale: {
          timeVisible: isIntradayRange(data.range),
          secondsVisible: false,
        },
      });
      chart.timeScale().fitContent();

      hoverTimeRef.current = null;
      setHoverTime(null);
    }, [data, indexByTime]);

    // ---- Support / resistance rays ----
    useEffect(() => {
      const toLine = (pts: TrendLines['support']): LineData<Time>[] =>
        pts.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));
      supportSeriesRef.current?.setData(toLine(trendLines.support));
      resistSeriesRef.current?.setData(toLine(trendLines.resistance));
    }, [trendLines]);

    // ---- Pivot markers (numbered once news lands, accent on panel hover) ----
    useEffect(() => {
      const candleSeries = candleSeriesRef.current;
      if (!candleSeries) return;
      const markers: SeriesMarker<Time>[] = pivots.map((p, i) => ({
        time: p.time as UTCTimestamp,
        position: p.kind === 'high' ? 'aboveBar' : 'belowBar',
        shape: p.kind === 'high' ? 'arrowDown' : 'arrowUp',
        color: highlight === i ? C.accent : p.kind === 'high' ? C.warn : C.up,
        text: numbered[i] ? String(i + 1) : undefined,
        size: highlight === i ? 2 : 1,
        id: `pivot-${i}`,
      }));
      // setMarkers requires ascending time; pivots already are, but keep the
      // guarantee explicit against future callers.
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      candleSeries.setMarkers(markers);
    }, [pivots, numbered, highlight]);

    useImperativeHandle(
      ref,
      () => ({
        scrollToPivot(index: number) {
          const chart = chartRef.current;
          const pivot = pivots[index];
          if (!chart || !pivot) return;
          const candleIndex = indexByTimeRef.current.get(pivot.time);
          if (candleIndex === undefined) return;
          const timeScale = chart.timeScale();
          const visible = timeScale.getVisibleLogicalRange();
          if (!visible) return;
          const half = Math.max(2, (visible.to - visible.from) / 2);
          timeScale.setVisibleLogicalRange({
            from: candleIndex - half,
            to: candleIndex + half,
          });
        },
      }),
      [pivots],
    );

    // ---- Crosshair legend (falls back to the last candle when idle) ----
    const intraday = isIntradayRange(data.range);
    const legend = useMemo(() => {
      const candles = data.candles;
      if (candles.length === 0) return null;
      const hovered = hoverTime !== null ? indexByTime.get(hoverTime) : undefined;
      const i = hovered ?? candles.length - 1;
      const c = candles[i];
      const prevClose = i > 0 ? candles[i - 1].close : c.open;
      const change = c.close - prevClose;
      const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : null;
      return { c, change, changePercent };
    }, [data, hoverTime, indexByTime]);

    return (
      <div className="cm-canvas">
        <div ref={hostRef} className="cm-canvas-host" />
        {legend && (
          <div className="cm-legend num">
            <span className="cm-legend-date">
              {formatCandleTime(legend.c.time, intraday)}
            </span>
            {(
              [
                ['O', legend.c.open],
                ['H', legend.c.high],
                ['L', legend.c.low],
                ['C', legend.c.close],
              ] as const
            ).map(([label, value]) => (
              <span
                key={label}
                className={legend.c.close >= legend.c.open ? 'up' : 'down'}
              >
                <span className="cm-legend-lbl">{label}</span>
                {formatPrice(value)}
              </span>
            ))}
            <span className={legend.change >= 0 ? 'up' : 'down'}>
              {formatSigned(legend.change)}
              {legend.changePercent !== null
                ? ` (${formatSignedPercent(legend.changePercent)})`
                : ''}
            </span>
            <span>
              <span className="cm-legend-lbl">Vol</span>
              {formatVolume(legend.c.volume)}
            </span>
          </div>
        )}
      </div>
    );
  },
);
