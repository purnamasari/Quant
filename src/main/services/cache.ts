// Tiny in-memory TTL cache. Used by http.ts (keyed by URL) and by services
// that cache derived results (holdings, earnings) keyed by symbol.
// Failures are never stored here — callers only set() on success.

interface Entry<V> {
  expires: number; // epoch ms
  value: V;
}

export class TtlCache<V> {
  private readonly map = new Map<string, Entry<V>>();

  constructor(private readonly maxEntries = 800) {}

  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V, ttlMs: number): void {
    if (ttlMs <= 0) return;
    if (this.map.size >= this.maxEntries) this.prune();
    this.map.set(key, { expires: Date.now() + ttlMs, value });
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (entry.expires <= now) this.map.delete(key);
    }
    // Still over budget (nothing expired)? Drop oldest-inserted entries.
    while (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.map.delete(oldest.value);
    }
  }
}
