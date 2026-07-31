// Does news actually predict anything? Two hypotheses, one dataset.
//
// H1 (filter): among cup-forming+confluence signals, do the ones firing amid
//     heavy news coverage outperform the quiet ones? If yes, news volume is a
//     free filter on a setup we already trade.
// H2 (standalone): does a news spike on its own — no price signal required —
//     precede a directional move? This is the "trade price action after news"
//     idea, stated in a way that can actually be measured.
//
// Both need a per-coin baseline, because raw article counts are meaningless
// across assets (Bitcoin outdraws ONDO by orders of magnitude). Volume is
// therefore z-scored against each coin's own history.
//
// Cost control: news comes from src/newsStore.js, which caches every window
// to disk forever. The first run pays ~1.5s per uncached week; later runs are
// instant. Harvesting is resumable — interrupt it and re-run, and it picks up
// where the cache left off.
//
// Scope: the four coins carrying 99 of the 111 historical signals (BTC, BNB,
// SOL, ETH). Full weekly coverage for those beats thin coverage of all twelve,
// since the per-coin baseline is what makes the z-score meaningful.
//
// CENSORING CAVEAT: Google caps a query at ~100 items, so a week busier than
// that reports 100. The analysis records how often the cap binds; where it
// binds often, "volume" is really "at least this much" and the z-score
// understates the true spread.

const { getDailyCandles } = require('../crypto/binance');
const { walkForwardOccurrences } = require('../stock/backtest');
const { atr } = require('../risk');
const { getWindow, dailyCounts, cacheStats, ymd, ITEM_CAP } = require('../newsStore');

const COINS = [
  { symbol: 'BTC-USDT', term: 'Bitcoin' },
  { symbol: 'BNB-USDT', term: 'BNB' },
  { symbol: 'SOL-USDT', term: 'Solana' },
  { symbol: 'ETH-USDT', term: 'Ethereum' },
];
const CONFLUENCE_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming', 'bos-bullish'];
const HOLD_DAYS = 7;
const TARGET_RR = 1.8;
const ATR_STOP = 1.5;
const DAY_MS = 86_400_000;
const WEEKS_BACK = 104;
const NEWS_LOOKBACK_DAYS = 3; // news window ending on the signal day itself

function simulateR(candles, entryIndex) {
  const entry = candles[entryIndex].close;
  const a = atr(candles.slice(0, entryIndex + 1), 14);
  if (!(a > 0) || !(entry > 0)) return null;
  const stopDistance = a * ATR_STOP;
  const stop = entry - stopDistance;
  const target = entry + stopDistance * TARGET_RR;
  for (let d = 1; d <= HOLD_DAYS; d++) {
    const idx = entryIndex + d;
    if (idx >= candles.length) break;
    if (candles[idx].low <= stop) return -1;
    if (candles[idx].high >= target) return TARGET_RR;
  }
  const exitIdx = Math.min(candles.length - 1, entryIndex + HOLD_DAYS);
  if (exitIdx <= entryIndex) return null;
  return (candles[exitIdx].close - entry) / stopDistance;
}

// Walk back WEEKS_BACK weeks, filling the cache. Resumable by construction:
// getWindow only hits the network for windows it has never stored.
async function harvest(log = console.log) {
  const now = Date.now();
  let fetched = 0;
  let cappedWeeks = 0;
  for (const { term } of COINS) {
    for (let w = 0; w < WEEKS_BACK; w++) {
      const end = now - w * 7 * DAY_MS;
      const start = end - 7 * DAY_MS;
      try {
        const res = await getWindow(term, ymd(start), ymd(end));
        if (!res.cached) fetched += 1;
        if (res.capped) cappedWeeks += 1;
      } catch (err) {
        log(`[newsBacktest] ${term} week -${w}: ${err.message}`);
      }
    }
    log(`[newsBacktest] ${term} done (${fetched} live fetches so far)`);
  }
  return { fetched, cappedWeeks, totalWeeks: COINS.length * WEEKS_BACK };
}

// Merge every cached weekly window for a coin into one day -> count map.
async function dailyCountsFor(term) {
  const now = Date.now();
  const counts = new Map();
  for (let w = 0; w < WEEKS_BACK; w++) {
    const end = now - w * 7 * DAY_MS;
    const start = end - 7 * DAY_MS;
    let res;
    try {
      res = await getWindow(term, ymd(start), ymd(end));
    } catch {
      continue;
    }
    for (const [day, n] of dailyCounts(res.items)) {
      // Windows overlap at their edges; keep the larger observation rather
      // than summing, so a day seen twice isn't double counted.
      counts.set(day, Math.max(counts.get(day) || 0, n));
    }
  }
  return counts;
}

function zScore(value, values) {
  const n = values.length;
  if (n < 10) return null;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return sd > 0 ? (value - mean) / sd : null;
}

function summarize(rs) {
  const n = rs.length;
  if (!n) return { trades: 0, winRate: null, avgR: null };
  return {
    trades: n,
    winRate: Math.round((rs.filter((r) => r > 0).length / n) * 1000) / 10,
    avgR: Math.round((rs.reduce((a, b) => a + b, 0) / n) * 1000) / 1000,
  };
}

async function analyze(log = console.log) {
  const signalRows = [];
  const spikeRows = [];
  let cappedDays = 0;
  let totalDays = 0;

  for (const { symbol, term } of COINS) {
    const candles = await getDailyCandles(symbol, 730);
    if (!candles || candles.length < 100) continue;
    const counts = await dailyCountsFor(term);
    if (counts.size < 30) {
      log(`[newsBacktest] ${term}: only ${counts.size} days of news, skipping`);
      continue;
    }
    const allCounts = [...counts.values()];
    totalDays += allCounts.length;
    cappedDays += allCounts.filter((c) => c >= ITEM_CAP).length;

    // News volume over the NEWS_LOOKBACK_DAYS ending on each candle's day.
    const volumeAt = (index) => {
      let sum = 0;
      let seen = 0;
      for (let d = 0; d < NEWS_LOOKBACK_DAYS; d++) {
        const idx = index - d;
        if (idx < 0) break;
        const day = ymd(candles[idx].time * 1000);
        if (counts.has(day)) { sum += counts.get(day); seen += 1; }
      }
      return seen ? sum / seen : null;
    };

    // Baseline distribution of that same measure, so the z-score compares
    // like with like.
    const baseline = [];
    for (let i = NEWS_LOOKBACK_DAYS; i < candles.length; i++) {
      const v = volumeAt(i);
      if (v !== null) baseline.push(v);
    }

    // H1: signals, split by news intensity
    const occurrences = walkForwardOccurrences(candles);
    const dayCounts = new Map();
    for (const kind of CONFLUENCE_KINDS) {
      for (const hit of occurrences[kind] || []) {
        dayCounts.set(hit.index, (dayCounts.get(hit.index) || 0) + 1);
      }
    }
    for (const hit of occurrences['cup-forming'] || []) {
      if ((dayCounts.get(hit.index) || 0) < 2) continue;
      const v = volumeAt(hit.index);
      if (v === null) continue;
      const z = zScore(v, baseline);
      if (z === null) continue;
      const r = simulateR(candles, hit.index);
      if (r === null) continue;
      signalRows.push({ symbol, z, r });
    }

    // H2: news spikes on their own, no price signal required
    for (let i = NEWS_LOOKBACK_DAYS; i < candles.length - HOLD_DAYS; i++) {
      const v = volumeAt(i);
      if (v === null) continue;
      const z = zScore(v, baseline);
      if (z === null || z < 2) continue; // spike = 2 sd above this coin's normal
      const r = simulateR(candles, i);
      if (r === null) continue;
      spikeRows.push({ symbol, z, r });
    }
  }

  return { signalRows, spikeRows, cappedDays, totalDays };
}

if (require.main === module) {
  const mode = process.argv[2] || 'all';
  (async () => {
    if (mode === 'harvest' || mode === 'all') {
      console.log('=== Harvesting news windows (cached; resumable) ===');
      const h = await harvest();
      console.log(`live fetches: ${h.fetched} of ${h.totalWeeks} weeks; ${h.cappedWeeks} weeks hit the ${ITEM_CAP}-item cap`);
      console.log('cache:', cacheStats());
    }
    if (mode === 'harvest') return;

    console.log('\n=== Analysing ===');
    const { signalRows, spikeRows, cappedDays, totalDays } = await analyze();

    console.log(`\nCensoring check: ${cappedDays}/${totalDays} days at the ${ITEM_CAP}-item cap ` +
      `(${totalDays ? Math.round((cappedDays / totalDays) * 1000) / 10 : 0}%)`);

    console.log(`\n=== H1: does news volume filter the cup-forming setup? ===`);
    console.log(`baseline (all signals): ${JSON.stringify(summarize(signalRows.map((x) => x.r)))}`);
    for (const [label, test] of [
      ['quiet     (z < 0)', (x) => x.z < 0],
      ['normal    (0-1)', (x) => x.z >= 0 && x.z < 1],
      ['busy      (1-2)', (x) => x.z >= 1 && x.z < 2],
      ['very busy (z >= 2)', (x) => x.z >= 2],
    ]) {
      console.log(`  ${label.padEnd(20)} ${JSON.stringify(summarize(signalRows.filter(test).map((x) => x.r)))}`);
    }

    console.log(`\n=== H2: news spike alone (z >= 2), no price signal ===`);
    console.log(`  ${JSON.stringify(summarize(spikeRows.map((x) => x.r)))}`);
    for (const { symbol } of COINS) {
      const rows = spikeRows.filter((x) => x.symbol === symbol);
      if (rows.length) console.log(`  ${symbol.padEnd(11)} ${JSON.stringify(summarize(rows.map((x) => x.r)))}`);
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { harvest, analyze, dailyCountsFor };
