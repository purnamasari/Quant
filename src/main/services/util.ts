// Small shared utilities for the main-process services: symbol validation,
// stable hashing, a seeded PRNG for deterministic sample data, concurrency
// limiting, and date helpers.

/** Ticker symbols we accept anywhere in the app (watchlist, IPC inputs). */
export const SYMBOL_RE = /^[A-Z0-9.^-]{1,12}$/i;

/** Normalize an unknown value to an uppercase validated symbol, or null. */
export function normalizeSymbol(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const sym = raw.trim().toUpperCase();
  return sym.length > 0 && SYMBOL_RE.test(sym) ? sym : null;
}

/** Validate an unknown IPC payload into a unique, bounded symbol list. */
export function cleanSymbolList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const entry of raw) {
    const sym = normalizeSymbol(entry);
    if (sym && !out.includes(sym)) {
      out.push(sym);
      if (out.length >= max) break;
    }
  }
  return out;
}

/** FNV-1a 32-bit hash with a configurable seed. Stable across runs. */
export function fnv1a(input: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Stable non-negative integer hash of a string. */
export function stableHash(input: string): number {
  return fnv1a(input);
}

/** Short stable id string derived from two hash passes (for NewsItem ids). */
export function hashId(input: string): string {
  return fnv1a(input).toString(36) + fnv1a(input, 0x9747b28c).toString(36);
}

/** mulberry32 PRNG — deterministic sequence in [0, 1) for a given seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Minimal promise-concurrency limiter (p-limit style). */
export function pLimit(concurrency: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = (): void => {
    active--;
    const run = queue.shift();
    if (run) run();
  };
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = (): void => {
        active++;
        fn().then(
          (value) => {
            next();
            resolve(value);
          },
          (err: unknown) => {
            next();
            reject(err);
          },
        );
      };
      if (active < concurrency) run();
      else queue.push(run);
    });
}

/** Format a Date as UTC YYYY-MM-DD. */
export function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's date as UTC YYYY-MM-DD. */
export function todayYmd(): string {
  return toYmd(new Date());
}

/** Parse any date-ish string to epoch ms, or null when unparseable. */
export function parseDateMs(value: string | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** Normalized form of a headline used for cross-source dedupe. */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Strip HTML tags and collapse whitespace (for RSS descriptions). */
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clamp an unknown numeric input to an integer within [min, max]. */
export function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : fallback;
  return Math.min(max, Math.max(min, n));
}

/** Round to 2 decimal places (prices). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
