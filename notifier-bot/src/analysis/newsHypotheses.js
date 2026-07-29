// Pre-registered hypothesis suite for trading macro releases.
//
// PRE-REGISTRATION MATTERS HERE. Seven hypotheses across two asset classes is
// fourteen tests; at a naive 5% threshold roughly one false positive is
// expected by construction. So the hypotheses, the horizons and the pass mark
// are all fixed in this header BEFORE any result is looked at, and the
// Bonferroni-corrected threshold is applied to every claim:
//
//     alpha 0.05 / 14 tests  =>  |t| > 2.9 to call anything real
//
// A result between |t| 2 and 2.9 is reported as "would pass alone, does not
// survive correction" rather than quietly promoted. This is the same standard
// that rejected pairs trading and the swing stop.
//
// ---------------------------------------------------------------------------
// H1  Directional drift. After a surprise, price moves in the direction the
//     surprise implies (hot inflation -> risk-off). Horizons: +15m/+60m for
//     crypto, +1h/+2h for stocks.
//
// H2  Clean-candle entry (crypto only — needs 1m bars). The user's "wait for a
//     clean candle" made falsifiable: enter at the first 1m bar after release
//     whose range is below the trailing 20-bar median AND whose close agrees
//     with the surprise direction. Exit +60m. Compared against a naive +1m
//     entry, so it has to beat doing nothing clever.
//
// H3  Momentum continuation, direction-agnostic. Ignore the surprise entirely;
//     follow the sign of the first 5 minutes (first hour for stocks). This
//     tests price action alone and does not depend on the surprise->direction
//     mapping being correct.
//
// H4  Fade the spike. The exact opposite of H3. Both are stated because the
//     earlier 75-day crypto run showed a non-monotonic path (+1m up, +5..15m
//     down, +60m up) that is consistent with either, and guessing which is
//     what pre-registration is meant to prevent.
//
// H5  Volatility expansion, direction-agnostic. Is the absolute move after a
//     release larger than a matched non-event baseline? This is the most
//     likely to be true and is actionable as a RISK rule (do not hold leveraged
//     positions through releases) even when no directional edge exists.
//
// H6  Surprise magnitude. Do larger surprises, measured as
//     |actual - consensus| / |consensus|, produce larger or more reliable
//     moves? Tested by bucketing rather than by fitting a line, so a single
//     outlier cannot manufacture a slope.
//
// H7  Cross-asset agreement. Do stocks and crypto react the same way to the
//     same release? If crypto merely follows equities, that is a different
//     (and far more crowded) trade than an independent crypto reaction.
//
// ---------------------------------------------------------------------------
// Controls applied throughout:
//   - Events flagged `directionConflict` are EXCLUDED. US releases cluster at
//     08:30 ET; when two in the same minute imply opposite directions the same
//     price move would otherwise be scored once as a win and once as a loss.
//   - Simultaneous same-direction releases are collapsed to one observation,
//     for the same reason: they are not independent samples.
//   - Every result reports n, mean, sd, se and t. A mean without dispersion is
//     not a finding.
//   - The period is split in half and both halves reported, so an effect that
//     exists in only one regime is visible as such.
//
// Data-availability constraint, stated rather than worked around: Yahoo serves
// stock intraday at 1h for ~730 days but 1m for only 7, so the stock side
// cannot be tested at minute resolution at all. Crypto is tested at both 1m
// and 1h; the 1h numbers are the ones compared across asset classes.

const { collect } = require('./newsScalpBacktest');

const CRYPTO_SYMBOLS = ['BTC-USDT', 'ETH-USDT'];
const STOCK_SYMBOLS = ['SPY', 'QQQ'];
const BONFERRONI_T = 2.9;
const CLEAN_LOOKBACK = 20;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------- statistics

function stat(values) {
  const v = values.filter(Number.isFinite);
  const n = v.length;
  if (n < 2) return { n, mean: null, sd: null, se: null, t: null, hitRate: null };
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1));
  const se = sd / Math.sqrt(n);
  return {
    n,
    mean: round(mean, 4),
    sd: round(sd, 3),
    se: round(se, 4),
    t: se > 0 ? round(mean / se, 2) : null,
    hitRate: round((v.filter((x) => x > 0).length / n) * 100, 1),
  };
}

function round(x, d) { const s = 10 ** d; return Math.round(x * s) / s; }

function verdict(s) {
  if (!s || s.t === null) return 'insufficient data';
  const a = Math.abs(s.t);
  if (a > BONFERRONI_T) return 'SURVIVES correction';
  if (a > 2) return 'passes alone, FAILS correction';
  return 'no effect';
}

function line(label, s) {
  if (!s || s.t === null) return `  ${label.padEnd(30)} n=${s?.n ?? 0}  (insufficient)`;
  return `  ${label.padEnd(30)} n=${String(s.n).padStart(3)}  mean=${String(s.mean).padStart(8)}%  sd=${String(s.sd).padStart(6)}  t=${String(s.t).padStart(6)}  hit=${String(s.hitRate).padStart(5)}%  ${verdict(s)}`;
}

// ------------------------------------------------------------------ fetching

// One 1h series per stock covers the whole period; indexing it beats a
// per-event request and avoids hammering Yahoo.
async function fetchStockHourly(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1h&range=730d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`yahoo ${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  if (!r?.timestamp) throw new Error(`yahoo ${symbol}: no data`);
  const q = r.indicators.quote[0];
  return r.timestamp.map((t, i) => ({
    time: t * 1000, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i],
  })).filter((c) => Number.isFinite(c.close));
}

async function fetchCryptoMinutes(symbol, releaseMs) {
  const out = new Map();
  let anchor = releaseMs + 61 * 60000;
  for (let page = 0; page < 3; page++) {
    const url = `https://www.okx.com/api/v5/market/history-candles?instId=${symbol}&bar=1m&limit=100&after=${anchor}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const json = await res.json();
    const rows = json?.data || [];
    if (!rows.length) break;
    for (const r of rows) {
      out.set(Number(r[0]), { time: Number(r[0]), open: +r[1], high: +r[2], low: +r[3], close: +r[4] });
    }
    anchor = Number(rows[rows.length - 1][0]);
    if (anchor < releaseMs - 62 * 60000) break;
    await sleep(120);
  }
  return [...out.values()].sort((a, b) => a.time - b.time);
}

function barAt(candles, ms) {
  let best = null;
  for (const c of candles) { if (c.time <= ms) best = c; else break; }
  return best;
}

function pct(from, to) { return from > 0 ? ((to - from) / from) * 100 : null; }

// -------------------------------------------------------------- event set-up

// Collapse simultaneous releases: same minute and same implied direction is
// one observation, not several. Opposite directions at the same minute are
// dropped entirely — the move cannot be attributed to either.
function dedupeEvents(events) {
  const byTime = new Map();
  for (const e of events) {
    if (!byTime.has(e.releaseMs)) byTime.set(e.releaseMs, []);
    byTime.get(e.releaseMs).push(e);
  }
  const out = [];
  let conflicts = 0;
  let collapsed = 0;
  for (const group of byTime.values()) {
    const dirs = new Set(group.map((e) => e.expected));
    if (dirs.size > 1) { conflicts += group.length; continue; }
    if (group.length > 1) collapsed += group.length - 1;
    // Keep the largest surprise as the representative of the minute.
    const rep = group.reduce((a, b) => {
      const sa = Math.abs(a.actual - a.consensus) / (Math.abs(a.consensus) || 1);
      const sb = Math.abs(b.actual - b.consensus) / (Math.abs(b.consensus) || 1);
      return sb > sa ? b : a;
    });
    rep.groupSize = group.length;
    out.push(rep);
  }
  return { events: out, conflicts, collapsed };
}

module.exports = {
  stat, verdict, line, round, dedupeEvents, barAt, pct,
  fetchStockHourly, fetchCryptoMinutes, collect,
  CRYPTO_SYMBOLS, STOCK_SYMBOLS, BONFERRONI_T, CLEAN_LOOKBACK, sleep,
};
