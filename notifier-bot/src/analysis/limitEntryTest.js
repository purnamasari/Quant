// Can a resting limit entry cut the cost assumption without costing more edge
// than it saves?
//
// Item 2 of data/profitability-plan.md: every number here assumes 0.25% round
// trip, taker in and taker out. A maker entry roughly halves that. With a
// 14-day hold, being filled ten minutes later should cost almost nothing —
// that is the thesis being tested.
//
// The grading model is taken from market-pulse's anticipatory.py, which gets
// the important part right: **never-filled is a third outcome and carries no
// R**. It is neither a win nor a loss. That makes the only fair comparison
// expected R *per signal* — fillRate x avgR(filled) — not avgR among the
// trades that happened to fill. Comparing fill-only averages against a
// market entry that always fills is how a limit strategy flatters itself.
//
// The prior here is not good, and it is worth stating before the numbers: the
// hourly pullback-entry test already failed in this repo for a structural
// reason (waiting for price to come back selects the signals that stalled),
// and these are breakout signals. A limit below the market is the same bet.
// The question is whether the cost saving outweighs that adverse selection.
//
// No network. Run: npm run test:limit-entry

const fs = require('node:fs');
const path = require('node:path');
const { walkForwardOccurrences } = require('../stock/backtest');
const { atr } = require('../risk');
const { RARE_TIER_UNIVERSE } = require('../crypto/universe');
const config = require('../config');

const DIR = path.join(__dirname, '..', '..', 'data', 'export');
const HOLD_DAYS = 14;
const ATR_STOP = 1.5;
// Bars the limit may rest before it is abandoned. Longer would raise fill rate
// while pushing entries further from the signal that justified them.
const FILL_WINDOW_BARS = 3;
const CONFLUENCE_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming', 'bos-bullish'];

// Round-trip cost in percent of notional.
//   taker/taker — what every existing figure in this repo assumes
//   maker/taker — resting limit in, market out
//   maker/maker — resting limit both ends (exit fill is not modelled, so this
//                 is an optimistic bound, labelled as such)
const COSTS = { 'taker/taker': 0.25, 'maker/taker': 0.15, 'maker/maker': 0.05 };

// Limit offsets below the signal close, as a fraction of the ATR stop distance.
// Expressed in ATR rather than percent so the depth means the same thing on
// BTC and on a midcap.
const OFFSETS = [0, 0.15, 0.3, 0.5];

function loadPairs() {
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    return {
      symbol: j.symbol,
      tier: j.universe === 'validated' ? 'bigcap' : 'midcap',
      candles: j.candles.map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v })),
    };
  });
}

// Returns { filled, r } — r is null when never filled.
// The stop distance is fixed by the ATR at the SIGNAL bar, not recomputed at
// the fill bar: the risk unit belongs to the setup, and letting it drift with
// the fill would silently change what 1R means between the two variants.
function simulate(candles, i, { offsetAtr, costPercent }) {
  const a = atr(candles.slice(0, i + 1), 14);
  const signalClose = candles[i].close;
  if (!(a > 0) || !(signalClose > 0)) return null;
  const sd = a * ATR_STOP;

  const limit = signalClose - a * offsetAtr;
  let fillIndex = -1;
  if (offsetAtr === 0) {
    fillIndex = i; // market entry at the signal close
  } else {
    for (let d = 1; d <= FILL_WINDOW_BARS; d++) {
      const j = i + d;
      if (j >= candles.length) break;
      if (candles[j].low <= limit) { fillIndex = j; break; }
    }
  }
  if (fillIndex === -1) return { filled: false, r: null };

  const entry = offsetAtr === 0 ? signalClose : limit;
  const stop = entry - sd;
  const costR = costPercent / ((sd / entry) * 100);

  // The hold clock starts at the FILL, matching how the position actually
  // exists. Starting it at the signal would shorten the trade for late fills.
  for (let d = 1; d <= HOLD_DAYS; d++) {
    const j = fillIndex + d;
    if (j >= candles.length) break;
    if (candles[j].low <= stop) return { filled: true, r: -1 - costR };
  }
  const j = Math.min(candles.length - 1, fillIndex + HOLD_DAYS);
  if (j <= fillIndex) return { filled: false, r: null };
  return { filled: true, r: (candles[j].close - entry) / sd - costR };
}

function stat(rs, attempts) {
  const v = rs.filter(Number.isFinite);
  const n = v.length;
  if (n < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1));
  const fillRate = attempts ? n / attempts : 0;
  return {
    n,
    attempts,
    fillRate,
    avgRFilled: m,
    // The number that decides it: R expected per SIGNAL, counting never-filled
    // as the zero it is.
    avgRPerSignal: m * fillRate,
    se: sd / Math.sqrt(n),
    wr: (v.filter((x) => x > 0).length / n) * 100,
  };
}

function main() {
  const pairs = loadPairs().filter((p) => p.candles.length >= 300);
  const enabled = config.alertCryptoKinds;

  // bucket -> variant -> { rs, attempts }
  const acc = {};
  const put = (bucket, variant, res) => {
    const cell = ((acc[bucket] ||= {})[variant] ||= { rs: [], attempts: 0 });
    cell.attempts += 1;
    if (res && res.filled) cell.rs.push(res.r);
  };

  for (const { symbol, tier, candles } of pairs) {
    const occ = walkForwardOccurrences(candles);
    const dayCounts = new Map();
    for (const kind of CONFLUENCE_KINDS) {
      for (const hit of occ[kind] || []) dayCounts.set(hit.index, (dayCounts.get(hit.index) || 0) + 1);
    }

    const entries = [];
    for (const kind of enabled) {
      for (const hit of occ[kind] || []) {
        entries.push({ index: hit.index, rare: kind === 'cup-forming' && (dayCounts.get(hit.index) || 0) >= 2 && RARE_TIER_UNIVERSE.includes(symbol) });
      }
    }

    for (const e of entries) {
      for (const offsetAtr of OFFSETS) {
        for (const [costName, costPercent] of Object.entries(COSTS)) {
          // Market entry pays taker on the way in by definition — a maker cost
          // on a market fill would be measuring a trade nobody can place.
          if (offsetAtr === 0 && costName !== 'taker/taker') continue;
          const res = simulate(candles, e.index, { offsetAtr, costPercent });
          if (res === null) continue;
          const variant = offsetAtr === 0 ? 'MARKET @ close (taker/taker)' : `limit -${offsetAtr} ATR (${costName})`;
          put(`enabled [${tier}]`, variant, res);
          if (e.rare) put('RARE tier', variant, res);
        }
      }
    }
  }

  console.log(`\npairs ${pairs.length} · hold ${HOLD_DAYS}d · limit rests ${FILL_WINDOW_BARS} bars`);
  console.log('avgR/signal counts never-filled as zero — that is the only fair comparison.\n');

  for (const bucket of Object.keys(acc)) {
    console.log(`── ${bucket} ──`);
    console.log('variant                              fill%   n     WR    avgR(filled)  avgR/signal');
    const rows = Object.entries(acc[bucket])
      .map(([variant, cell]) => ({ variant, s: stat(cell.rs, cell.attempts) }))
      .filter((x) => x.s)
      .sort((a, b) => b.s.avgRPerSignal - a.s.avgRPerSignal);
    for (const { variant, s } of rows) {
      console.log(
        `${variant.padEnd(36)} ${(s.fillRate * 100).toFixed(0).padStart(4)}% ${String(s.n).padStart(5)} ` +
        `${s.wr.toFixed(1).padStart(5)}% ${s.avgRFilled.toFixed(3).padStart(12)} ${s.avgRPerSignal.toFixed(3).padStart(12)}`,
      );
    }
    const market = rows.find((r) => r.variant.startsWith('MARKET'));
    const best = rows[0];
    if (market && best && best.variant !== market.variant) {
      const d = best.s.avgRPerSignal - market.s.avgRPerSignal;
      console.log(`\n  best limit beats market by ${(d >= 0 ? '+' : '') + d.toFixed(3)}R per signal`);
    } else if (market) {
      console.log('\n  MARKET entry is best — no limit variant beats it per signal');
    }
    console.log();
  }
}

if (require.main === module) main();

module.exports = { main };
