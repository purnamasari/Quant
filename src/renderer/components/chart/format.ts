// Formatting helpers shared by the chart modal (header, legend, news panel).
// All candle/pivot timestamps are unix seconds UTC and lightweight-charts
// renders its time axis in UTC, so every formatter here pins timeZone:'UTC'
// to keep the legend/panel consistent with the axis.

import type { ChartRange } from '../../../shared/types';

/** Ranges the chart treats as intraday: axis shows times, not just dates. */
export function isIntradayRange(range: ChartRange): boolean {
  return range === '1d' || range === '1w' || range === '1m';
}

/** 2 decimals for normal prices, 4 below $1, none at 10k+ (index levels). */
export function formatPrice(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 10_000 ? 0 : abs < 1 ? 4 : 2;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Signed absolute change: "+1.23" / "-0.45". Zero renders as "+0.00" so the
 *  direction is never conveyed by colour alone. */
export function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : '-'}${formatPrice(Math.abs(value))}`;
}

/** Signed percent: "+1.23%" / "-0.45%". */
export function formatSignedPercent(value: number): string {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(2)}%`;
}

/** Compact volume: 1.24B / 12.40M / 830.1K / 412. */
export function formatVolume(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(Math.round(value));
}

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const dateYearFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const timeFmt = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

function formatDate(d: Date): string {
  return d.getUTCFullYear() === new Date().getUTCFullYear()
    ? dateFmt.format(d)
    : dateYearFmt.format(d);
}

/** Absolute article date: "Jun 12", or "Jun 12, 2024" for other years. */
export function formatNewsDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : formatDate(d);
}

/** Candle/pivot timestamp: "Jun 12" (daily) or "Jun 12 · 14:30" (intraday). */
export function formatCandleTime(unixSeconds: number, intraday: boolean): string {
  const d = new Date(unixSeconds * 1000);
  if (Number.isNaN(d.getTime())) return '';
  return intraday ? `${formatDate(d)} · ${timeFmt.format(d)}` : formatDate(d);
}
