// Does market regime change which strategies work?
//
// The question matters because the answer decides whether the live scan should
// re-rank conviction by regime at all. A regime layer is exactly the kind of
// plausible-sounding filter AGENTS.md warns about: it will always produce a
// table with differences in it, because splitting any sample three ways
// produces three different numbers. The test is whether those differences are
// bigger than the noise created by splitting, and whether they survive the
// control.
//
// The control is the part that cannot be skipped. In a bull regime a RANDOM
// entry is profitable — that is what a bull market is. Comparing a strategy's
// bull-regime expectancy against zero would "discover" that every strategy
// works in bulls. So every strategy row is measured against the random-entry
// baseline *within the same regime*, and only the difference is meaningful.
//
// Regime comes from BTC via src/regime.js and is evaluated at ENTRY time using
// only closed candles up to that bar.
//
// This script also EMITS data/regime-adjustments.json, which the live scan
// reads. Only cells that clear an evidence bar are written; everything else is
// recorded with `adjust: 0` so the file documents what was tested and refused
// rather than silently omitting it. The bar is defined in PASSES_BAR below and
// includes an independence guard, which is the guard that actually matters
// here: regime days arrive in contiguous blocks, so 40 trades inside one
// three-month stretch is closer to n=1 than n=40.
//
// No network — reads data/export/. Run: npm run scoreboard:regime

const fs = require('node:fs');
const path = require('node:path');
const { walkForwardOccurrences } = require('../stock/backtest');
const { atr } = require('../risk');
const { classifyAt } = require('../regime');
const { RARE_TIER_UNIVERSE } = require('../crypto/universe');

const DIR = path.join(__dirname, '..', '..', 'data', 'export');
const COST_PERCENT = 0.25;
const HOLD_DAYS = 14;
const ATR_STOP = 1.5;
const CONFLUENCE_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming', 'bos-bullish'];
const REGIMES = ['bull', 'sideways', 'bear'];
// Below this a per-regime cell is reported but never acted on. Splitting 102
// rare-tier trades three ways leaves ~34 per cell before any regime imbalance.
const MIN_ACTIONABLE_N = 30;

function loadPair(file) {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  return {
    symbol: j.symbol,
    tier: j.universe === 'validated' ? 'bigcap' : 'midcap',
    candles: j.candles.map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c, volume: c.v })),
  };
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

// A regime cell may adjust live conviction only if all four hold:
//   1. enough trades to measure at all
//   2. it beats (or loses to) the same-regime random control by t > 2 — the
//      only comparison that means anything, since a bull market lifts random
//      entries too
//   3. those trades are spread across enough distinct calendar months that the
//      cell is not one episode wearing a costume
//   4. no single month holds most of the cell
const MIN_MONTHS = 6;
const MAX_SINGLE_MONTH_SHARE = 0.4;

function passesBar(cell) {
  if (!cell || cell.n < MIN_ACTIONABLE_N) return { ok: false, why: `n=${cell?.n ?? 0} < ${MIN_ACTIONABLE_N}` };
  if (!(Math.abs(cell.tVsRandom) > 2)) return { ok: false, why: `t vs random = ${cell.tVsRandom.toFixed(2)}, need |t|>2` };
  if (cell.months < MIN_MONTHS) return { ok: false, why: `only ${cell.months} distinct months, need ${MIN_MONTHS}` };
  if (cell.topMonthShare > MAX_SINGLE_MONTH_SHARE) {
    return { ok: false, why: `${(cell.topMonthShare * 100).toFixed(0)}% of trades in one month, max ${MAX_SINGLE_MONTH_SHARE * 100}%` };
  }
  return { ok: true, why: 'clears n, t-vs-random, and independence guards' };
}

function monthSpread(times) {
  const months = {};
  for (const t of times) {
    const m = new Date(t * 1000).toISOString().slice(0, 7);
    months[m] = (months[m] || 0) + 1;
  }
  const counts = Object.values(months);
  return {
    months: counts.length,
    topMonthShare: counts.length ? Math.max(...counts) / times.length : 1,
  };
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
    se: sd / Math.sqrt(n),
    t: m / (sd / Math.sqrt(n)),
    wr: (wins.length / n) * 100,
    rr: avgLoss > 0 ? avgWin / avgLoss : null,
  };
}

let seed = 23;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
  const pairs = files.map(loadPair).filter((p) => p.candles.length >= 300);

  // BTC drives the regime for every symbol.
  const btc = pairs.find((p) => p.symbol === 'BTC-USDT');
  if (!btc) throw new Error('BTC-USDT missing from data/export — regime cannot be classified');
  const regimeByTime = new Map();
  for (let i = 0; i < btc.candles.length; i++) {
    const r = classifyAt(btc.candles, i);
    if (r) regimeByTime.set(btc.candles[i].time, r);
  }

  const dist = {};
  for (const r of regimeByTime.values()) dist[r] = (dist[r] || 0) + 1;
  const labelled = regimeByTime.size;
  console.log(`\nRegime distribution over ${labelled} classified BTC days ` +
    `(${btc.candles.length - labelled} unclassified — 200SMA warm-up):`);
  for (const r of REGIMES) {
    const n = dist[r] || 0;
    console.log(`  ${r.padEnd(9)} ${String(n).padStart(4)} days  ${((n / labelled) * 100).toFixed(1)}%`);
  }

  // strategy -> regime -> [{ r, time }]. The entry time is carried through
  // because the independence guard needs to know when the trades happened, not
  // just how many there were.
  const byStrategy = {};
  const put = (name, regime, r, time) => {
    ((byStrategy[name] ||= {})[regime] ||= []).push({ r, time });
  };

  for (const { symbol, tier, candles } of pairs) {
    const occ = walkForwardOccurrences(candles);
    const dayCounts = new Map();
    for (const kind of CONFLUENCE_KINDS) {
      for (const hit of occ[kind] || []) dayCounts.set(hit.index, (dayCounts.get(hit.index) || 0) + 1);
    }

    let fires = 0;
    for (const [kind, hits] of Object.entries(occ)) {
      for (const hit of hits) {
        const time = candles[hit.index].time;
        const regime = regimeByTime.get(time);
        if (!regime) continue; // outside the classified window
        const r = simulate(candles, hit.index, hit.direction);
        if (r === null) continue;
        fires += 1;
        put(kind, regime, r, time);
        if (kind === 'cup-forming' && (dayCounts.get(hit.index) || 0) >= 2 && RARE_TIER_UNIVERSE.includes(symbol)) {
          put('RARE (as shipped)', regime, r, time);
        }
        if ((dayCounts.get(hit.index) || 0) >= 2) put(`ANY+confluence [${tier}]`, regime, r, time);
      }
    }

    for (let k = 0; k < Math.min(fires, 60); k++) {
      const lo = 60;
      const span = candles.length - lo - HOLD_DAYS - 1;
      if (span <= 0) break;
      const i = lo + Math.floor(rnd() * span);
      const time = candles[i].time;
      const regime = regimeByTime.get(time);
      if (!regime) continue;
      const r = simulate(candles, i);
      if (r !== null) put('RANDOM (control)', regime, r, time);
    }
  }

  const rs = (list) => (list || []).map((x) => x.r);
  const control = byStrategy['RANDOM (control)'] || {};
  const controlStat = Object.fromEntries(REGIMES.map((r) => [r, stat(rs(control[r]))]));

  console.log('\nRANDOM-ENTRY BASELINE per regime — every row below is judged against these:');
  for (const r of REGIMES) {
    const s = controlStat[r];
    console.log(`  ${r.padEnd(9)} ${s ? `n=${String(s.n).padStart(4)}  avgR ${s.avgR.toFixed(3).padStart(7)}  WR ${s.wr.toFixed(1)}%` : 'no data'}`);
  }

  const names = Object.keys(byStrategy)
    .filter((n) => n !== 'RANDOM (control)')
    .map((name) => {
      const cells = Object.fromEntries(REGIMES.map((r) => {
        const rows = byStrategy[name][r] || [];
        const s = stat(rs(rows));
        if (!s) return [r, null];
        const ctrl = controlStat[r];
        const edge = ctrl ? s.avgR - ctrl.avgR : null;
        return [r, {
          ...s,
          ...monthSpread(rows.map((x) => x.time)),
          edgeVsRandom: edge,
          tVsRandom: ctrl && ctrl.se ? edge / Math.sqrt(s.se ** 2 + ctrl.se ** 2) : 0,
        }];
      }));
      const total = stat(REGIMES.flatMap((r) => rs(byStrategy[name][r])));
      return { name, cells, total };
    })
    .filter((x) => x.total && x.total.n >= 60)
    .sort((a, b) => b.total.avgR - a.total.avgR);

  const cell = (s) => {
    if (!s) return '     —                    ';
    const edge = s.edgeVsRandom;
    const flag = s.n < MIN_ACTIONABLE_N ? '·' : (Math.abs(s.tVsRandom) > 2 ? '*' : ' ');
    return `${String(s.n).padStart(4)} ${s.wr.toFixed(0).padStart(3)}% ${s.avgR.toFixed(2).padStart(6)} ` +
      `${edge !== null ? (edge >= 0 ? '+' : '') + edge.toFixed(2) : '  — '}${flag}`;
  };

  console.log('\n  * = beats random in that regime by t>2   · = n below ' + MIN_ACTIONABLE_N + ', not actionable');
  console.log('  columns: n  WR  avgR  (avgR minus random in the same regime)\n');
  console.log('strategy                     |        BULL              |      SIDEWAYS            |         BEAR');
  console.log('-'.repeat(110));
  for (const { name, cells } of names) {
    console.log(
      `${name.padEnd(28)} | ${cell(cells.bull)} | ${cell(cells.sideways)} | ${cell(cells.bear)}`,
    );
  }

  // ── Emit the file the live scan reads ───────────────────────────────────────
  const out = {
    _meta: {
      generatedBy: 'src/analysis/regimeScoreboard.js',
      generatedAt: new Date().toISOString().slice(0, 10),
      window: '730 daily candles from data/export/',
      exit: `ATR*${ATR_STOP} stop, no fixed target, ${HOLD_DAYS}-day hold, ${COST_PERCENT}% round trip`,
      regimeSource: 'BTC-USDT via src/regime.js (200SMA position + slope)',
      bar: {
        minN: MIN_ACTIONABLE_N,
        minAbsTVsRandom: 2,
        minDistinctMonths: MIN_MONTHS,
        maxSingleMonthShare: MAX_SINGLE_MONTH_SHARE,
      },
      note: 'adjust is a conviction step: +1 promotes one tier, -1 demotes one, 0 means the '
        + 'evidence did not clear the bar and conviction is left alone. Cells that failed are '
        + 'kept with their reason so the next person can see what was tested, not just what passed.',
      independenceWarning: 'Regime days arrive in contiguous blocks. Over this window bear was a '
        + 'SINGLE 180-day episode and 88% of the sideways rare-tier trades fell in three months, '
        + 'which is why the month-spread guards exist and why almost nothing passes yet.',
    },
    episodes: {},
    strategies: {},
  };

  const epi = {};
  let prev = null;
  for (const [time, r] of [...regimeByTime.entries()].sort((a, b) => a[0] - b[0])) {
    if (r !== prev) { epi[r] = (epi[r] || 0) + 1; prev = r; }
  }
  for (const r of REGIMES) out.episodes[r] = { days: dist[r] || 0, episodes: epi[r] || 0 };

  let passed = 0;
  for (const { name, cells } of names) {
    out.strategies[name] = {};
    for (const r of REGIMES) {
      const c = cells[r];
      if (!c) { out.strategies[name][r] = { n: 0, adjust: 0, reason: 'no trades in this regime' }; continue; }
      const verdict = passesBar(c);
      if (verdict.ok) passed += 1;
      out.strategies[name][r] = {
        n: c.n,
        winRate: Math.round(c.wr * 10) / 10,
        avgR: Math.round(c.avgR * 1000) / 1000,
        edgeVsRandom: Math.round(c.edgeVsRandom * 1000) / 1000,
        tVsRandom: Math.round(c.tVsRandom * 100) / 100,
        distinctMonths: c.months,
        topMonthShare: Math.round(c.topMonthShare * 100) / 100,
        adjust: verdict.ok ? (c.edgeVsRandom > 0 ? 1 : -1) : 0,
        reason: verdict.why,
      };
    }
  }

  const file = path.join(__dirname, '..', '..', 'data', 'regime-adjustments.json');
  fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`\nWrote ${path.relative(process.cwd(), file)} — ` +
    `${passed} of ${names.length * REGIMES.length} regime cells cleared the evidence bar.`);
  if (passed === 0) {
    console.log('No cell qualifies, so conviction is NOT adjusted by regime on this data. That is the');
    console.log('correct outcome, not a failure: the mechanism is live and will start acting on its');
    console.log('own once enough independent regime episodes have accumulated.');
  }
  console.log();
}

if (require.main === module) main();

module.exports = { main };
