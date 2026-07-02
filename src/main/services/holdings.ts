// holdings:get — top-20 ETF holdings. Tries the live quoteSummary
// topHoldings module (usually top 10) and merges it over the bundled
// snapshot (live weights win, bundle fills the list out to 20). Any
// failure returns the bundled data flagged 'sample'.

import type { Holding, HoldingsResult } from '../../shared/types';
import { TtlCache } from './cache';
import { getBundleAsOf, getEtfBundle } from './dataFiles';
import { round2, todayYmd } from './util';
import { quoteSummary, rawNumber } from './yahoo';

const LIVE_TTL_MS = 12 * 60 * 60_000; // 12h
const SAMPLE_TTL_MS = 15 * 60_000; // retry live sooner after a failure
const MAX_HOLDINGS = 20;

const cache = new TtlCache<HoldingsResult>(200);
const inFlight = new Map<string, Promise<HoldingsResult>>();

function bundledResult(etfSymbol: string): HoldingsResult {
  const entry = getEtfBundle().etfs[etfSymbol];
  return {
    etfSymbol,
    asOf: getBundleAsOf(),
    holdings: entry ? entry.holdings.slice(0, MAX_HOLDINGS) : [],
    source: 'sample',
  };
}

async function fetchLiveHoldings(etfSymbol: string): Promise<Holding[]> {
  const summary = await quoteSummary(etfSymbol, ['topHoldings']);
  const raw = summary.topHoldings?.holdings;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`no live topHoldings for ${etfSymbol}`);
  }
  const out: Holding[] = [];
  for (const h of raw) {
    const symbol = typeof h.symbol === 'string' ? h.symbol.toUpperCase().trim() : '';
    if (!symbol || out.some((x) => x.symbol === symbol)) continue;
    const fraction = rawNumber(h.holdingPercent);
    out.push({
      symbol,
      name: typeof h.holdingName === 'string' && h.holdingName ? h.holdingName : symbol,
      weightPercent: fraction === null ? null : round2(fraction * 100),
    });
  }
  if (out.length === 0) throw new Error(`unusable live topHoldings for ${etfSymbol}`);
  return out;
}

function mergeWithBundle(etfSymbol: string, live: Holding[]): Holding[] {
  const merged: Holding[] = [...live];
  const bundle = getEtfBundle().etfs[etfSymbol];
  if (bundle) {
    for (const h of bundle.holdings) {
      if (merged.length >= MAX_HOLDINGS) break;
      if (merged.some((x) => x.symbol === h.symbol)) continue;
      merged.push(h);
    }
    // Prefer the curated names where live gave us none/terse ones? Live wins
    // per spec — but do backfill missing names from the bundle.
    for (const item of merged) {
      if (item.name === item.symbol) {
        const known = bundle.holdings.find((x) => x.symbol === item.symbol);
        if (known) item.name = known.name;
      }
    }
  }
  merged.sort((a, b) => (b.weightPercent ?? -1) - (a.weightPercent ?? -1));
  return merged.slice(0, MAX_HOLDINGS);
}

export async function getHoldings(etfSymbol: string): Promise<HoldingsResult> {
  const sym = etfSymbol.toUpperCase();
  const cached = cache.get(sym);
  if (cached) return cached;
  const pending = inFlight.get(sym);
  if (pending) return pending;

  const promise = (async (): Promise<HoldingsResult> => {
    try {
      const live = await fetchLiveHoldings(sym);
      const result: HoldingsResult = {
        etfSymbol: sym,
        asOf: todayYmd(),
        holdings: mergeWithBundle(sym, live),
        source: 'live',
      };
      cache.set(sym, result, LIVE_TTL_MS);
      return result;
    } catch {
      const result = bundledResult(sym);
      cache.set(sym, result, SAMPLE_TTL_MS);
      return result;
    }
  })().finally(() => {
    inFlight.delete(sym);
  });

  inFlight.set(sym, promise);
  return promise;
}
