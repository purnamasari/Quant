// HTTP layer used by every data service.
//  - Browser User-Agent on all requests (Yahoo 429s without it).
//  - 12s timeout via AbortSignal.timeout.
//  - Up to 2 retries with backoff; 4xx (except 429) is not retried.
//  - Per-host concurrency limiter: max 4 in flight per host, and ~250ms
//    spacing between request starts for query1.finance.yahoo.com.
//  - In-memory TTL cache keyed by URL (caller decides the TTL).
//    Failures are NEVER cached. Identical in-flight GETs are coalesced.

import { TtlCache } from './cache';
import { sleep } from './util';

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface FetchOptions {
  /** Cache TTL in ms; 0 (default) disables caching for this call. */
  ttlMs?: number;
  /** Per-attempt timeout in ms. */
  timeoutMs?: number;
  /** Extra headers merged over the default User-Agent. */
  headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 3; // 1 initial + 2 retries
const RETRY_DELAYS_MS = [500, 1400];

// ---------------------------------------------------------------------------
// Per-host limiter
// ---------------------------------------------------------------------------

class HostLimiter {
  private active = 0;
  private nextSlot = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly spacingMs: number,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    return new Promise((resolve) => {
      const attempt = (): void => {
        if (this.active >= this.maxConcurrent) {
          this.waiting.push(attempt);
          return;
        }
        const now = Date.now();
        const wait = this.nextSlot - now;
        if (wait > 0) {
          setTimeout(attempt, wait);
          return;
        }
        this.active++;
        this.nextSlot = now + this.spacingMs;
        resolve();
      };
      attempt();
    });
  }

  private release(): void {
    this.active--;
    const next = this.waiting.shift();
    if (next) next();
  }
}

const limiters = new Map<string, HostLimiter>();

function limiterFor(host: string): HostLimiter {
  let limiter = limiters.get(host);
  if (!limiter) {
    const spacing = host === 'query1.finance.yahoo.com' ? 250 : 0;
    limiter = new HostLimiter(4, spacing);
    limiters.set(host, limiter);
  }
  return limiter;
}

// ---------------------------------------------------------------------------
// Cache + in-flight coalescing (successful text bodies only)
// ---------------------------------------------------------------------------

const bodyCache = new TtlCache<string>(600);
const inFlight = new Map<string, Promise<string>>();

async function doFetch(
  url: string,
  host: string,
  headers: Record<string, string> | undefined,
  timeoutMs: number,
): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new HttpError(`HTTP ${res.status} from ${host}`, res.status);
  }
  return res.text();
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string> | undefined,
  timeoutMs: number,
): Promise<string> {
  const host = new URL(url).hostname;
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await limiterFor(host).run(() => doFetch(url, host, headers, timeoutMs));
    } catch (err) {
      lastErr = err;
      const status = err instanceof HttpError ? err.status : undefined;
      const retryable =
        status === undefined || status === 429 || status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS - 1) throw err;
      await sleep(RETRY_DELAYS_MS[attempt] ?? 1500);
    }
  }
  // Unreachable, but keeps TS happy.
  throw lastErr instanceof Error ? lastErr : new Error(`fetch failed: ${url}`);
}

/** Fetch a URL as text, honoring the TTL cache and per-host limits. */
export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const ttlMs = opts.ttlMs ?? 0;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (ttlMs > 0) {
    const cached = bodyCache.get(url);
    if (cached !== undefined) return cached;
    const pending = inFlight.get(url);
    if (pending) return pending;
  }

  const promise = fetchWithRetry(url, opts.headers, timeoutMs)
    .then((body) => {
      if (ttlMs > 0) bodyCache.set(url, body, ttlMs);
      return body;
    })
    .finally(() => {
      inFlight.delete(url);
    });

  if (ttlMs > 0) inFlight.set(url, promise);
  return promise;
}

/** Fetch a URL and JSON.parse the body. T describes the expected raw shape. */
export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const body = await fetchText(url, opts);
  try {
    return JSON.parse(body) as T;
  } catch {
    // A cached body should never be unparseable JSON unless the endpoint
    // returned HTML (e.g. an error page) — don't keep serving it.
    bodyCache.delete(url);
    throw new Error(`Invalid JSON from ${new URL(url).hostname}`);
  }
}
