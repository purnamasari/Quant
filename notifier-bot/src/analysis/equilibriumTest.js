// Does buying at a DISCOUNT actually improve anything?
//
// Ported from purnamasari/market-pulse (engine/smc/equilibrium.py) — see
// src/equilibrium.js for why that module and not the other 75. The SMC claim
// is that longs should be bought below the midpoint of the current dealing
// range, and that claim has never been tested in this repo.
//
// Measured exactly like every other candidate here so the numbers are
// comparable to the scoreboard: same 730d window from data/export/, same
// validated exit (ATR*1.5 stop, no target, 14-day hold), same 0.25% round
// trip, same bigcap/midcap split, and — the part that decides it — the same
// random-entry control, with the control ALSO split by location so that
// "discount entries did better" cannot be an artifact of discount bars simply
// being better bars to enter on regardless of signal.
//
// That last control is the one that matters. If random entries at a discount
// also beat random entries at a premium by a similar margin, then the filter
// is measuring the market, not the signal, and adds nothing on top of what we
// already have.
//
// No network. Run: npm run test:equilibrium

const fs = require('node:fs');
const path = require('node:path');
const { walkForwardOccurrences } = require('../stock/backtest');
const { atr } = require('../risk');
const { locationAt } = require('../equilibrium');
const { RARE_TIER_UNIVERSE } = require('../crypto/universe');
const config = require('../config');

const DIR = path.join(__dirname, '..', '..', 'data', 'export');
const COST_PERCENT = 0.25;
const HOLD_DAYS = 14;
const ATR_STOP = 1.5;
const CONFLUENCE_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming', 'bos-bullish'];
// Structure needs enough bars for pivots to exist at all; pivotWindow scales
// with the slice length, so a short slice yields no swings and no range.
const MIN_SLICE = 120;

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

function simulate(candles, i) {
  const entry = candles[i].close;
  const a = atr(candles.slice(0, i + 1), 14);
  if (!(a > 0) || !(entry > 0)) return null;
  const sd = a * ATR_STOP;
  const stop = entry - sd;
  const costR = COST_PERCENT / ((sd / entry) * 100);
  for (let d = 1; d <= HOLD_DAYS; d++) {
    const j = i + d;
    if (j >= candles.length) break;
    if (candles[j].low <= stop) return -1 - costR;
  }
  const j = Math.min(candles.length - 1, i + HOLD_DAYS);
  if (j <= i) return null;
  return (candles[j].close - entry) / sd - costR;
}

function stat(xs) {
  const v = xs.filter(Number.isFinite);
  const n = v.length;
  if (n < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1));
  return {
    n,
    avgR: m,
    se: sd / Math.sqrt(n),
    wr: (v.filter((x) => x > 0).length / n) * 100,
  };
}

function diff(a, b) {
  if (!a || !b) return null;
  const d = a.avgR - b.avgR;
  return { d, t: d / Math.sqrt(a.se ** 2 + b.se ** 2) };
}

let seed = 31;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

function main() {
  const pairs = loadPairs().filter((p) => p.candles.length >= 300);
  const enabled = config.alertCryptoKinds;

  // bucket -> location -> [R]
  const buckets = {};
  const put = (bucket, loc, r) => { ((buckets[bucket] ||= {})[loc] ||= []).push(r); };
  let noRange = 0;
  let withRange = 0;

  for (const { symbol, tier, candles } of pairs) {
    const occ = walkForwardOccurrences(candles);
    const dayCounts = new Map();
    for (const kind of CONFLUENCE_KINDS) {
      for (const hit of occ[kind] || []) dayCounts.set(hit.index, (dayCounts.get(hit.index) || 0) + 1);
    }

    // Location is recomputed from the candles visible at each entry bar, never
    // from the full series — that is the whole replay-safety argument.
    const locCache = new Map();
    const locationFor = (i) => {
      if (locCache.has(i)) return locCache.get(i);
      const loc = i >= MIN_SLICE ? locationAt(candles.slice(0, i + 1)) : null;
      locCache.set(i, loc);
      return loc;
    };

    let fires = 0;
    for (const kind of enabled) {
      for (const hit of occ[kind] || []) {
        const loc = locationFor(hit.index);
        if (!loc) { noRange += 1; continue; }
        withRange += 1;
        const r = simulate(candles, hit.index);
        if (r === null) continue;
        fires += 1;
        put(`enabled kinds [${tier}]`, loc.position, r);
        if (kind === 'cup-forming'
          && (dayCounts.get(hit.index) || 0) >= 2
          && RARE_TIER_UNIVERSE.includes(symbol)) {
          put('RARE tier', loc.position, r);
        }
      }
    }

    // The decisive control: random entries, bucketed by the SAME location read.
    for (let k = 0; k < Math.min(Math.max(fires, 10), 60); k++) {
      const lo = MIN_SLICE;
      const span = candles.length - lo - HOLD_DAYS - 1;
      if (span <= 0) break;
      const i = lo + Math.floor(rnd() * span);
      const loc = locationFor(i);
      if (!loc) continue;
      const r = simulate(candles, i);
      if (r !== null) put(`RANDOM [${tier}]`, loc.position, r);
    }
  }

  console.log(`\npairs ${pairs.length} · ${HOLD_DAYS}d hold · ${COST_PERCENT}% cost`);
  console.log(`dealing range resolved on ${withRange} of ${withRange + noRange} signal bars ` +
    `(${((withRange / (withRange + noRange)) * 100).toFixed(1)}%)\n`);

  const order = ['discount', 'equilibrium', 'premium'];
  console.log('bucket                       location      n    WR     avgR');
  console.log('-'.repeat(66));
  for (const bucket of Object.keys(buckets)) {
    for (const loc of order) {
      const s = stat(buckets[bucket][loc] || []);
      if (!s) continue;
      console.log(
        `${bucket.padEnd(28)} ${loc.padEnd(12)} ${String(s.n).padStart(4)} ` +
        `${s.wr.toFixed(1).padStart(5)}% ${s.avgR.toFixed(3).padStart(8)}`,
      );
    }
    const d = diff(stat(buckets[bucket].discount || []), stat(buckets[bucket].premium || []));
    if (d) {
      console.log(`${''.padEnd(28)} discount − premium = ${(d.d >= 0 ? '+' : '') + d.d.toFixed(3)}R ` +
        `(t ${d.t.toFixed(2)})${Math.abs(d.t) > 2 ? '  <= significant' : '  <= not significant'}`);
    }
    console.log();
  }

  // The question that decides whether this ships.
  console.log('THE TEST — does the filter beat the same filter applied to random entries?');
  for (const tier of ['bigcap', 'midcap']) {
    const sig = diff(stat(buckets[`enabled kinds [${tier}]`]?.discount || []),
      stat(buckets[`enabled kinds [${tier}]`]?.premium || []));
    const ctl = diff(stat(buckets[`RANDOM [${tier}]`]?.discount || []),
      stat(buckets[`RANDOM [${tier}]`]?.premium || []));
    if (!sig || !ctl) continue;
    console.log(
      `  ${tier}: signal discount-premium ${(sig.d >= 0 ? '+' : '') + sig.d.toFixed(3)}R ` +
      `vs random discount-premium ${(ctl.d >= 0 ? '+' : '') + ctl.d.toFixed(3)}R ` +
      `→ net ${((sig.d - ctl.d) >= 0 ? '+' : '') + (sig.d - ctl.d).toFixed(3)}R`,
    );
  }
  console.log();
}

if (require.main === module) main();

module.exports = { main };
