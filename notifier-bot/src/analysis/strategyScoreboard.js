// Per-strategy scoreboard split by market-cap tier — the table that did not
// exist. Individual numbers were scattered across five documents, measured over
// different windows with different exit rules, and almost never split
// bigcap/midcap. Anything compared across those documents was comparing
// different experiments.
//
// Everything here is measured the same way, so the rows are actually
// comparable:
//   - identical window: 730 daily candles per pair, from data/export/
//   - identical exit: ATR*1.5 stop, NO fixed target, 14-day hold (the validated
//     rule from data/crypto-signal-validation.md "Exit rule revised")
//   - identical cost: 0.25% round trip, converted to R by dividing by the stop
//     width in percent, which makes every figure leverage-independent
//   - identical tiers: `validated` = the original 12 large-caps, `midcap` = the
//     18 out-of-universe pairs. That split is the whole point: the out-of-universe
//     test is what has killed the most convincing candidates in this project.
//
// RR here is REALIZED reward:risk (mean win / mean loss), not the 1.8 or 3.0
// planned on the ticket. A planned RR nobody reaches is not a property of the
// strategy, as the tradeway H18 run showed — 11 trades, every one exited at
// stop, target never touched.
//
// No network. Run: npm run scoreboard

const fs = require('node:fs');
const path = require('node:path');
const { walkForwardOccurrences } = require('../stock/backtest');
const { atr } = require('../risk');
const { RARE_TIER_UNIVERSE } = require('../crypto/universe');

const DIR = path.join(__dirname, '..', '..', 'data', 'export');
const COST_PERCENT = 0.25;
const HOLD_DAYS = 14;
const ATR_STOP = 1.5;
const CONFLUENCE_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming', 'bos-bullish'];

function load() {
  return fs.readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
      return {
        symbol: j.symbol,
        tier: j.universe === 'validated' ? 'bigcap' : 'midcap',
        // Stored with short keys to keep the cache small.
        candles: j.candles.map((c) => ({
          time: c.t, open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v,
        })),
      };
    });
}

function simulate(candles, i, direction = 'long') {
  const entry = candles[i].close;
  const a = atr(candles.slice(0, i + 1), 14);
  if (!(a > 0) || !(entry > 0)) return null;
  const sd = a * ATR_STOP;
  const long = direction !== 'short';
  const stop = long ? entry - sd : entry + sd;
  const costR = COST_PERCENT / ((sd / entry) * 100);
  for (let d = 1; d <= HOLD_DAYS; d++) {
    const j = i + d;
    if (j >= candles.length) break;
    if (long ? candles[j].low <= stop : candles[j].high >= stop) return -1 - costR;
  }
  const j = Math.min(candles.length - 1, i + HOLD_DAYS);
  if (j <= i) return null;
  const move = (candles[j].close - entry) / sd;
  return (long ? move : -move) - costR;
}

function stat(xs) {
  const v = xs.filter(Number.isFinite);
  const n = v.length;
  if (n < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1));
  const wins = v.filter((x) => x > 0);
  const losses = v.filter((x) => x <= 0);
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
  return {
    n,
    avgR: m,
    t: m / (sd / Math.sqrt(n)),
    wr: (wins.length / n) * 100,
    // Realized RR. Infinite when nothing lost, which only happens on samples
    // too small to mean anything, so it is shown as a dash rather than a number.
    rr: avgLoss > 0 ? avgWin / avgLoss : null,
  };
}

let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

function main() {
  const data = load();
  const byTier = { bigcap: {}, midcap: {} };
  const push = (tier, name, r) => { (byTier[tier][name] ||= []).push(r); };

  for (const { symbol, tier, candles } of data) {
    if (candles.length < 200) continue;
    const occ = walkForwardOccurrences(candles);

    const dayCounts = new Map();
    for (const kind of CONFLUENCE_KINDS) {
      for (const hit of occ[kind] || []) dayCounts.set(hit.index, (dayCounts.get(hit.index) || 0) + 1);
    }

    let fires = 0;
    for (const [kind, hits] of Object.entries(occ)) {
      for (const hit of hits) {
        const r = simulate(candles, hit.index, hit.direction);
        if (r === null) continue;
        fires += 1;
        push(tier, kind, r);

        if (kind === 'cup-forming' && (dayCounts.get(hit.index) || 0) >= 2) {
          push(tier, 'RARE cup-forming+confluence', r);
          // The live tier is scoped to RARE_TIER_UNIVERSE, not to every bigcap,
          // so the number the bot actually acts on is tracked separately.
          if (RARE_TIER_UNIVERSE.includes(symbol)) push(tier, 'RARE (as shipped, scoped)', r);
        }
        if ((dayCounts.get(hit.index) || 0) >= 2) push(tier, 'ANY kind + confluence>=2', r);
      }
    }

    for (let k = 0; k < Math.min(fires, 60); k++) {
      const lo = 60;
      const span = candles.length - lo - HOLD_DAYS - 1;
      if (span <= 0) break;
      const r = simulate(candles, lo + Math.floor(rnd() * span));
      if (r !== null) push(tier, 'RANDOM entry (control)', r);
    }
  }

  const names = [...new Set([...Object.keys(byTier.bigcap), ...Object.keys(byTier.midcap)])];
  const rows = names.map((name) => ({
    name,
    big: stat(byTier.bigcap[name] || []),
    mid: stat(byTier.midcap[name] || []),
    all: stat([...(byTier.bigcap[name] || []), ...(byTier.midcap[name] || [])]),
  })).filter((r) => r.all && r.all.n >= 20);

  rows.sort((a, b) => b.all.avgR - a.all.avgR);

  const f = (s, key, d = 2) => (s && s[key] !== null && s[key] !== undefined ? s[key].toFixed(d) : '—');
  const cell = (s) => (s && s.n >= 20
    ? `${String(s.n).padStart(5)} ${f(s, 'wr', 1).padStart(5)}% ${f(s, 'avgR', 3).padStart(7)} ${f(s, 'rr').padStart(5)}`
    : `${s ? String(s.n).padStart(5) : '    0'}  ${'thin'.padStart(4)}       —     —`);

  // Emit the machine-readable form the live alert reads, so the message quotes
  // measured numbers instead of restating a label. Rank is stored here rather
  // than recomputed at send time — the alert should show the same ordering the
  // scoreboard shows, and a rank computed live from a different sample would
  // quietly disagree with the table it claims to come from.
  const randomRow = rows.find((r) => r.name === 'RANDOM entry (control)');
  const stats = {
    _meta: {
      generatedBy: 'src/analysis/strategyScoreboard.js',
      generatedAt: new Date().toISOString().slice(0, 10),
      window: '730 daily candles per pair from data/export/',
      exit: `ATR*${ATR_STOP} stop, no fixed target, ${HOLD_DAYS}-day hold`,
      costPercent: COST_PERCENT,
      holdDays: HOLD_DAYS,
      totalRanked: rows.length,
      randomBaseline: randomRow
        ? {
          all: Math.round(randomRow.all.avgR * 1000) / 1000,
          bigcap: randomRow.big ? Math.round(randomRow.big.avgR * 1000) / 1000 : null,
          midcap: randomRow.mid ? Math.round(randomRow.mid.avgR * 1000) / 1000 : null,
        }
        : null,
      note: 'avgR is expectancy in R after cost, where 1R = the ATR*1.5 stop distance. '
        + 'rr is REALIZED reward:risk (mean win / mean loss), not a planned target.',
    },
    strategies: {},
  };
  rows.forEach((r, i) => {
    const pack = (s) => (s && s.n >= 20
      ? {
        n: s.n,
        winRate: Math.round(s.wr * 10) / 10,
        avgR: Math.round(s.avgR * 1000) / 1000,
        rr: s.rr === null ? null : Math.round(s.rr * 100) / 100,
        t: Math.round(s.t * 100) / 100,
      }
      : null);
    stats.strategies[r.name] = {
      rank: i + 1,
      of: rows.length,
      all: pack(r.all),
      bigcap: pack(r.big),
      midcap: pack(r.mid),
      beatsRandom: randomRow && r.all ? Math.round((r.all.avgR - randomRow.all.avgR) * 1000) / 1000 : null,
    };
  });
  const statsFile = path.join(__dirname, '..', '..', 'data', 'strategy-stats.json');
  fs.writeFileSync(statsFile, `${JSON.stringify(stats, null, 2)}\n`);

  console.log(`\nAll pairs: ${data.length} (${data.filter((d) => d.tier === 'bigcap').length} bigcap, ${data.filter((d) => d.tier === 'midcap').length} midcap)`);
  console.log(`730d daily · ATR*1.5 stop, no target, ${HOLD_DAYS}d hold · ${COST_PERCENT}% round trip\n`);
  console.log('rank strategy                          |     n    WR    avgR    RR |  BIGCAP: n    WR    avgR    RR |  MIDCAP: n    WR    avgR    RR |     t');
  console.log('-'.repeat(160));
  rows.forEach((r, i) => {
    console.log(
      `${String(i + 1).padStart(3)}. ${r.name.padEnd(32)} |` +
      ` ${cell(r.all)} |  ${cell(r.big)} |  ${cell(r.mid)} | ${f(r.all, 't').padStart(6)}`,
    );
  });
  console.log();
}

if (require.main === module) main();

module.exports = { main };
