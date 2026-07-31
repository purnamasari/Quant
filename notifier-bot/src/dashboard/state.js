// Everything the Mini App renders, assembled in one place.
//
// Split out of server.js because the sections have genuinely different data
// lifetimes: signals and events come from files the jobs already wrote and are
// free to read, while regime and money flow need live candles. The expensive
// half is cached in memory so opening the app three times in a minute does not
// make three rounds of OKX and Yahoo calls.

const fs = require('node:fs');
const path = require('node:path');
const { recentSignals } = require('../signalStore');
const { getDailyCandles, getFundingRate } = require('../crypto/binance');
const { getChart } = require('../stock/yahoo');
const { classifyLatest, REGIME_LABEL } = require('../regime');
const { marketStructure } = require('../marketStructure');
const { getMacroEventsForDate, tomorrowYmd } = require('../macro');
const { getTomorrowUnlocks } = require('../tokenUnlocks');
const { getCryptoNews } = require('../news');
const { statsFor } = require('../signalStats');
const cryptoUniverse = require('../crypto/universe');
const { etToUtc } = require('../time');
const { generateForecast } = require('../forecast/engine');
const { djb2 } = require('../forecast/input');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const LIVE_TTL_MS = 5 * 60 * 1000;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch {
    return fallback;
  }
}

const cache = new Map();
async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < LIVE_TTL_MS) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

// ── Regime, both markets ────────────────────────────────────────────────────
// Crypto uses BTC, the same benchmark the scan uses. Stocks use SPY through
// the identical 200SMA classifier rather than a second method, so the two
// readings mean the same thing and can sit side by side without a footnote.
async function regimes() {
  const out = { crypto: null, stock: null };

  try {
    const btc = await getDailyCandles('BTCUSDT', 300);
    out.crypto = {
      symbol: 'BTCUSDT',
      regime: classifyLatest(btc),
      label: REGIME_LABEL[classifyLatest(btc)] || 'UNKNOWN',
      last: btc[btc.length - 1].close,
      changePercent: pctChange(btc, 7),
    };
  } catch (err) {
    out.crypto = { symbol: 'BTC-USDT', regime: null, error: err.message };
  }

  try {
    const chart = await getChart('SPY', '2y', '1d');
    const candles = chart.candles || [];
    out.stock = {
      symbol: 'SPY',
      regime: classifyLatest(candles),
      label: REGIME_LABEL[classifyLatest(candles)] || 'UNKNOWN',
      last: candles.length ? candles[candles.length - 1].close : null,
      changePercent: pctChange(candles, 7),
    };
  } catch (err) {
    out.stock = { symbol: 'SPY', regime: null, error: err.message };
  }

  try {
    const s = await marketStructure();
    out.structure = {
      daily: s.daily.bias,
      fourHour: s.fourHour.bias,
      conflict: Boolean(s.daily.bias && s.fourHour.bias && s.daily.bias !== s.fourHour.bias),
      lastDailyBreak: s.daily.lastBreak,
    };
  } catch {
    out.structure = null;
  }

  return out;
}

function pctChange(candles, bars) {
  if (!candles || candles.length < bars + 1) return null;
  const a = candles[candles.length - 1 - bars].close;
  const b = candles[candles.length - 1].close;
  return a > 0 ? Math.round(((b - a) / a) * 1000) / 10 : null;
}

// ── Money flow ──────────────────────────────────────────────────────────────
// A proxy, and labelled as one in the UI. Real order-flow data (spot netflow,
// exchange in/out) is not available from the public endpoints this bot uses,
// so flow is inferred from what is: volume weighted by candle direction over
// the last 7 days versus the prior 7, plus the perp funding rate, which is the
// one direct read on positioning we can actually get.
//
// Deliberately NOT presented as a signal. Nothing here has been validated as
// predictive, and given how many plausible readings in this project turned out
// to be noise, an unvalidated flow number that looked actionable would be a
// liability.
async function moneyFlow() {
  const symbols = cryptoUniverse.getUniverse();
  const rows = [];
  for (const symbol of symbols) {
    try {
      const candles = await getDailyCandles(symbol, 40);
      if (candles.length < 15) continue;
      const recent = candles.slice(-7);
      const prior = candles.slice(-14, -7);
      const signed = (cs) => cs.reduce((a, c) => a + (c.close >= c.open ? c.volume : -c.volume), 0);
      const total = (cs) => cs.reduce((a, c) => a + c.volume, 0);
      const netRecent = signed(recent);
      const volRecent = total(recent);
      const volPrior = total(prior);
      const funding = await getFundingRate(symbol).catch(() => null);
      rows.push({
        symbol,
        // -1 (all down-volume) .. +1 (all up-volume)
        netFlowRatio: volRecent > 0 ? Math.round((netRecent / volRecent) * 100) / 100 : null,
        volumeChangePercent: volPrior > 0 ? Math.round(((volRecent - volPrior) / volPrior) * 1000) / 10 : null,
        changePercent: pctChange(candles, 7),
        fundingRate: funding?.fundingRate != null ? Number(funding.fundingRate) : null,
      });
    } catch {
      // one pair failing must not empty the section
    }
  }
  rows.sort((a, b) => (b.netFlowRatio ?? -9) - (a.netFlowRatio ?? -9));
  return rows;
}

// ── Events with countdown ───────────────────────────────────────────────────
// Countdown is computed client-side from `atUtc` so it keeps ticking without
// polling; the server only supplies the absolute instant.
async function events() {
  const out = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const date of [today, tomorrowYmd()]) {
    try {
      const list = await getMacroEventsForDate(date);
      for (const e of list) {
        const at = etToUtc(date, e.time);
        if (!at) continue;
        out.push({
          kind: 'macro',
          name: e.name,
          atUtc: at.toISOString(),
          consensus: e.consensus,
          previous: e.previous,
          actual: e.actual,
        });
      }
    } catch {
      // a failed date should not blank the other one
    }
  }
  for (const u of getTomorrowUnlocks() || []) {
    out.push({ kind: 'unlock', name: `${u.symbol} token unlock — ${u.note || ''}`.trim(), atUtc: null });
  }
  const now = Date.now();
  return out
    .filter((e) => !e.atUtc || new Date(e.atUtc).getTime() > now - 6 * 3600 * 1000)
    .sort((a, b) => new Date(a.atUtc || 0) - new Date(b.atUtc || 0))
    .slice(0, 12);
}

async function news(limit = 8) {
  try {
    return (await getCryptoNews('crypto market', limit)) || [];
  } catch {
    return [];
  }
}

// ── Per-token detail ────────────────────────────────────────────────────────
async function tokenDetail(symbol) {
  const universe = cryptoUniverse.getUniverse();
  if (!universe.includes(symbol)) return { error: 'unknown symbol' };
  const candles = await getDailyCandles(symbol, 300);
  const capTier = cryptoUniverse.DEFAULT_VALIDATION_UNIVERSE.includes(symbol) ? 'bigcap' : 'midcap';
  const signals = recentSignals({ days: 90 }).filter((s) => s.symbol === symbol);
  const funding = await getFundingRate(symbol).catch(() => null);
  let forecast = null;

  try {
    const lastClose = candles[candles.length - 1].close;
    const a = require('../risk').atr(candles, 14) || lastClose * 0.02;
    const latestDirection = signals.length && signals[signals.length - 1].direction;
    const direction = latestDirection === 'short' || latestDirection === 'long' ? latestDirection : 'long';
    const sign = direction === 'long' ? 1 : -1;
    forecast = generateForecast({
      candles: candles.slice(-60),
      direction,
      takeProfit: lastClose + sign * 2 * a,
      stopLoss: lastClose - sign * 2 * a,
      entry: lastClose,
      regime: null,
      candleCount: 7,
      seed: djb2('dash|' + symbol + '|' + new Date().toISOString().slice(0, 10)),
    });
  } catch (err) {
    console.log(`[dashboard] forecast failed: ${err.message}`);
  }

  return {
    symbol,
    capTier,
    rareTierEligible: cryptoUniverse.RARE_TIER_UNIVERSE.includes(symbol),
    last: candles[candles.length - 1].close,
    change7d: pctChange(candles, 7),
    change30d: pctChange(candles, 30),
    fundingRate: funding?.fundingRate != null ? Number(funding.fundingRate) : null,
    // Enough points to draw a sparkline without shipping 300 candles.
    spark: candles.slice(-60).map((c) => c.close),
    candles: candles.slice(-60).map((c) => ({
      time: c.time, open: c.open, high: c.high, low: c.low, close: c.close,
    })),
    forecast,
    signals: signals.slice().reverse().slice(0, 20),
    stats: statsFor({ kind: 'cup-forming', rareTier: true, capTier }),
  };
}

// ── Summary + full state ────────────────────────────────────────────────────
async function fullState({ days = 14 } = {}) {
  const stats = readJson('strategy-stats.json', { _meta: {}, strategies: {} });
  const regimeTable = readJson('regime-adjustments.json', { episodes: {}, strategies: {} });
  const signals = recentSignals({ days });

  const [reg, flow, ev, newsItems] = await Promise.all([
    cached('regimes', regimes),
    cached('flow', moneyFlow),
    cached('events', events),
    cached('news', () => news(8)),
  ]);

  const ranked = Object.entries(stats.strategies || {})
    .map(([name, row]) => ({ name, ...row }))
    .sort((a, b) => a.rank - b.rank);

  const active = signals.slice().reverse();
  return {
    generatedAt: new Date().toISOString(),
    meta: stats._meta || {},
    randomBaseline: stats._meta?.randomBaseline || null,
    summary: {
      days,
      total: signals.length,
      notified: signals.filter((s) => s.notified).length,
      silent: signals.filter((s) => !s.notified).length,
      cryptoRegime: reg.crypto?.regime || null,
      stockRegime: reg.stock?.regime || null,
      structureConflict: reg.structure?.conflict || false,
      // "Next event" must be one that has not happened yet. A future timestamp
      // is not sufficient: Nasdaq mis-dates releases often enough that a row
      // dated tomorrow can already carry an `actual` (Thursday's jobless claims
      // sitting on Friday's date), and headlining an already-published figure
      // as upcoming is worse than showing nothing.
      nextEvent: ev.find((e) => e.atUtc && new Date(e.atUtc).getTime() > Date.now() && !e.actual) || null,
    },
    regimes: reg,
    moneyFlow: flow,
    signals: active,
    ranked,
    news: newsItems,
    events: ev,
    regimeEpisodes: regimeTable.episodes || {},
  };
}

module.exports = { fullState, tokenDetail, regimes, moneyFlow, events, news };
