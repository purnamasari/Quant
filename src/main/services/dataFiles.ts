// Lazy readers for the JSON datasets bundled next to main.js.
// The build copies src/main/data -> dist/main/data, so at runtime the files
// live at path.join(__dirname, 'data', ...). Corrupt/missing files degrade
// to empty datasets — callers must handle that.

import fs from 'node:fs';
import path from 'node:path';
import type { Holding, InstrumentType } from '../../shared/types';

export interface EtfBundleEntry {
  name: string;
  holdings: Holding[];
}

export interface EtfHoldingsBundle {
  _meta?: { note?: string; asOf?: string };
  etfs: Record<string, EtfBundleEntry>;
}

export interface DirectoryEntry {
  symbol: string;
  name: string;
  type: InstrumentType;
  exchange?: string;
}

function readJson(fileName: string): unknown {
  try {
    const filePath = path.join(__dirname, 'data', fileName);
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch (err) {
    console.error(`[data] failed to read ${fileName}:`, err);
    return null;
  }
}

let etfBundleCache: EtfHoldingsBundle | null = null;

export function getEtfBundle(): EtfHoldingsBundle {
  if (etfBundleCache) return etfBundleCache;
  const raw = readJson('etf-holdings.json') as EtfHoldingsBundle | null;
  const etfs: Record<string, EtfBundleEntry> = {};
  if (raw && typeof raw === 'object' && raw.etfs && typeof raw.etfs === 'object') {
    for (const [symbol, entry] of Object.entries(raw.etfs)) {
      if (!entry || typeof entry.name !== 'string' || !Array.isArray(entry.holdings)) continue;
      const holdings: Holding[] = [];
      for (const h of entry.holdings) {
        if (!h || typeof h.symbol !== 'string' || typeof h.name !== 'string') continue;
        holdings.push({
          symbol: h.symbol.toUpperCase(),
          name: h.name,
          weightPercent: typeof h.weightPercent === 'number' ? h.weightPercent : null,
        });
      }
      etfs[symbol.toUpperCase()] = { name: entry.name, holdings };
    }
  }
  etfBundleCache = {
    _meta: raw?._meta,
    etfs,
  };
  return etfBundleCache;
}

/** The asOf label for the bundled holdings snapshot. */
export function getBundleAsOf(): string {
  return getEtfBundle()._meta?.asOf ?? '2026-06';
}

let directoryCache: DirectoryEntry[] | null = null;

export function getSymbolDirectory(): DirectoryEntry[] {
  if (directoryCache) return directoryCache;
  const raw = readJson('symbol-directory.json') as
    | { symbols?: unknown }
    | null;
  const out: DirectoryEntry[] = [];
  if (raw && Array.isArray(raw.symbols)) {
    for (const entry of raw.symbols) {
      const e = entry as Partial<DirectoryEntry>;
      if (
        typeof e.symbol === 'string' &&
        typeof e.name === 'string' &&
        (e.type === 'etf' || e.type === 'stock')
      ) {
        out.push({
          symbol: e.symbol.toUpperCase(),
          name: e.name,
          type: e.type,
          exchange: typeof e.exchange === 'string' ? e.exchange : undefined,
        });
      }
    }
  }
  directoryCache = out;
  return directoryCache;
}

/** Exact-symbol lookup in the offline directory. */
export function directoryLookup(symbol: string): DirectoryEntry | undefined {
  const sym = symbol.toUpperCase();
  return getSymbolDirectory().find((e) => e.symbol === sym);
}

/** Best-effort display name for a symbol from any bundled dataset. */
export function lookupName(symbol: string): string | undefined {
  const dir = directoryLookup(symbol);
  if (dir) return dir.name;
  const bundle = getEtfBundle();
  const etf = bundle.etfs[symbol.toUpperCase()];
  if (etf) return etf.name;
  for (const entry of Object.values(bundle.etfs)) {
    const hit = entry.holdings.find((h) => h.symbol === symbol.toUpperCase());
    if (hit) return hit.name;
  }
  return undefined;
}
