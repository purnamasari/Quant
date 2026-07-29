// Disk-backed store for date-windowed news lookups.
//
// Why this exists: backtesting anything news-related needs hundreds of
// date-bounded queries, and Google News rate-limits hard — an early attempt
// that fired four requests 800ms apart got HTTP 503 on all four, while the
// same URLs succeeded once spaced out. Re-fetching on every backtest run
// would be both slow and self-defeating.
//
// News for a window that has already closed is immutable, so a hit is
// cached forever and never revalidated. Only windows never seen before cost
// a request, which means the first run of an analysis is slow and every run
// after it is instant.
//
// Storage: one JSON file per coin under data/news-cache/, keyed by
// "after|before". Only the fields the analyses need are kept (title, publish
// time, source) — not links or descriptions — so the cache stays small
// enough to live in git and keep results reproducible.
//
// IMPORTANT CAVEAT for anything measuring news VOLUME: Google returns at
// most ~100 items per query. For a heavily-covered asset over a wide window
// the true count is censored at that ceiling, so a raw article count is a
// lower bound, not a measurement. `getWindow` reports `capped` so callers
// can detect and handle it rather than silently treating 100 as the answer.

const fs = require('node:fs');
const path = require('node:path');

const CACHE_DIR = path.join(__dirname, '..', 'data', 'news-cache');
const ITEM_CAP = 100; // Google's practical per-query ceiling
const MIN_INTERVAL_MS = 1500; // polite spacing between live fetches
const MAX_RETRIES = 4;
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

let lastFetchAt = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cachePathFor(coin) {
  return path.join(CACHE_DIR, `${coin.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
}

function loadCoinCache(coin) {
  const file = cachePathFor(coin);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function saveCoinCache(coin, cache) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePathFor(coin), JSON.stringify(cache));
}

function parseItems(xml) {
  const items = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1];
    const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1];
    if (!title || !pubDate) continue; // undated items are useless for a backtest
    const ms = Date.parse(pubDate);
    if (Number.isNaN(ms)) continue;
    items.push({
      t: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
      d: ms,
      s: (source || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
    });
  }
  return items;
}

async function fetchWindow(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastFetchAt));
    if (wait > 0) await sleep(wait);
    lastFetchAt = Date.now();
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    if (res.ok) return parseItems(await res.text());
    // 429/503 are the rate-limit signals seen in practice — back off and retry.
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    throw new Error(`google news HTTP ${res.status}`);
  }
  throw new Error('google news: retries exhausted');
}

function ymd(date) {
  return new Date(date).toISOString().slice(0, 10);
}

// coin: a search term ("Bitcoin", "Solana"). after/before: YYYY-MM-DD or Date.
// Returns { items, capped, cached }.
async function getWindow(coin, after, before, { log = () => {} } = {}) {
  const afterYmd = typeof after === 'string' ? after : ymd(after);
  const beforeYmd = typeof before === 'string' ? before : ymd(before);
  const key = `${afterYmd}|${beforeYmd}`;
  const cache = loadCoinCache(coin);
  if (cache[key]) {
    return { items: cache[key].items, capped: cache[key].items.length >= ITEM_CAP, cached: true };
  }
  const query = `${coin} crypto after:${afterYmd} before:${beforeYmd}`;
  const items = await fetchWindow(query);
  cache[key] = { fetchedAt: Date.now(), items };
  saveCoinCache(coin, cache);
  log(`[newsStore] fetched ${coin} ${afterYmd}..${beforeYmd} -> ${items.length} items`);
  return { items, capped: items.length >= ITEM_CAP, cached: false };
}

// Article counts bucketed by UTC day, for volume-based analyses.
function dailyCounts(items) {
  const counts = new Map();
  for (const item of items) {
    const day = ymd(item.d);
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  return counts;
}

function cacheStats() {
  if (!fs.existsSync(CACHE_DIR)) return { coins: 0, windows: 0, bytes: 0 };
  let windows = 0;
  let bytes = 0;
  const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const full = path.join(CACHE_DIR, file);
    bytes += fs.statSync(full).size;
    try {
      windows += Object.keys(JSON.parse(fs.readFileSync(full, 'utf8'))).length;
    } catch { /* ignore unreadable cache file */ }
  }
  return { coins: files.length, windows, bytes };
}

module.exports = { getWindow, dailyCounts, cacheStats, ymd, ITEM_CAP };
