// One watchlist row: symbol / name / ETF-holdings meta on the left, price and
// change chip on the right, a hover-revealed remove button, and a brief
// green/red background pulse on the price when it changes between renders.

import '../../styles/watchlist.css';
import React, { memo, useEffect, useRef, useState } from 'react';
import type { HoldingsResult, Quote, WatchlistItem } from '../../../shared/types';

interface WatchlistRowProps {
  item: WatchlistItem;
  quote: Quote | undefined;
  holdings: HoldingsResult | undefined;
  onOpen: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

function XIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function formatPrice(price: number): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Humanize a holdings snapshot date ("2026-07-02" → "Jul 2",
 *  "2026-07" → "Jul 2026"). Falls back to the raw string. */
function formatAsOf(asOf: string): string {
  const [y, m, d] = asOf.split('-').map(Number);
  if (!y || !m) return asOf;
  if (!d) {
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  }
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/** Signed percent text + chip variant. Sign is always explicit ("+"/"−") so
 *  the direction never relies on color alone. */
function changeChip(quote: Quote | undefined): { text: string; variant: string } {
  if (!quote || quote.changePercent == null) return { text: '—', variant: 'flat' };
  const pct = quote.changePercent;
  const abs = Math.abs(pct).toFixed(2);
  if (pct > 0) return { text: `+${abs}%`, variant: 'up' };
  if (pct < 0) return { text: `−${abs}%`, variant: 'down' };
  return { text: '0.00%', variant: 'flat' };
}

interface Flash {
  dir: 'up' | 'down';
  key: number;
}

export const WatchlistRow = memo(function WatchlistRow({
  item,
  quote,
  holdings,
  onOpen,
  onRemove,
}: WatchlistRowProps) {
  const price = quote?.price ?? null;

  // Flash the price cell when the value moves between renders. The ref keeps
  // the previous price; the incrementing key remounts the span so the CSS
  // animation restarts even during an in-flight pulse.
  const prevPriceRef = useRef<number | null>(price);
  const [flash, setFlash] = useState<Flash | null>(null);

  useEffect(() => {
    const prev = prevPriceRef.current;
    prevPriceRef.current = price;
    if (price == null || prev == null || price === prev) return;
    const dir: Flash['dir'] = price > prev ? 'up' : 'down';
    setFlash((f) => ({ dir, key: (f?.key ?? 0) + 1 }));
  }, [price]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 900);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const chip = changeChip(quote);
  const isSample = quote?.source === 'sample';

  return (
    <li className="wl-row-wrap">
      <button
        type="button"
        className="wl-row"
        onClick={() => onOpen(item.symbol)}
        title={`Open ${item.symbol} chart`}
      >
        <span className="wl-row-main">
          <span className="wl-sym-line">
            <span className="wl-sym num">{item.symbol}</span>
            {isSample && (
              <span className="wl-sample-chip" title="Sample data">
                S
              </span>
            )}
          </span>
          <span className="wl-name">{item.name}</span>
          {item.type === 'etf' && holdings && (
            <span className="wl-meta">
              Top 20 holdings · as of {formatAsOf(holdings.asOf)}
            </span>
          )}
        </span>
        <span className="wl-row-quote">
          <span
            key={flash?.key ?? 0}
            className={`wl-price num${price == null ? ' wl-price-missing' : ''}${
              flash ? ` wl-flash-${flash.dir}` : ''
            }`}
          >
            {price != null ? formatPrice(price) : '—'}
          </span>
          <span className={`wl-chip num wl-chip-${chip.variant}`}>{chip.text}</span>
        </span>
      </button>
      <button
        type="button"
        className="wl-remove"
        aria-label={`Remove ${item.symbol} from watchlist`}
        title={`Remove ${item.symbol}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.symbol);
        }}
      >
        <XIcon />
      </button>
    </li>
  );
});
