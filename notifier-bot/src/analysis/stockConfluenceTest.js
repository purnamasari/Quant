// Should the stock side keep the same confluence requirement that made the
// crypto side work — or be switched off entirely?
//
// Prompted by a live problem, not curiosity: one scheduled run sent 59 stock
// alerts with charts in a single batch. Every enabled stock kind is thin after
// cost (cup-forming 0.02%, momentum 0.04%, golden-cross 0.01%, ob-bullish
// 0.11%), so those 59 messages carry very little edge — and they bury the rare
// crypto ⭐⭐⭐ alert that fires once every 6-10 days at 0.949R. Volume that
// trains you to ignore the bot is worse than no alerts at all.
//
// Confluence is the obvious candidate because it is what turned crypto
// cup-forming from 0.44% into 0.949R. It has never been tested on stocks.
//
// Design mirrors the crypto validation exactly so the numbers are comparable:
// same confluence definition (>=2 enabled kinds firing on the same day), the
// validated exit rule (ATR*1.5 stop, NO fixed target, 14-day hold), 0.15%
// round-trip cost (the stock convention — tighter spreads than crypto), and
// the two controls that have overturned the most conclusions in this project:
// a random-entry baseline and a split-half stability check.
//
// Candles are cached to disk. Yahoo is slow and rate-limited, and re-running an
// analysis should not re-pay for data that cannot change.

const fs = require('node:fs');
const path = require('node:path');
const { getChart } = require('../stock/yahoo');
const { walkForwardOccurrences } = require('../stock/backtest');
const { getUniverse } = require('../stock/universe');
const { atr } = require('../risk');
const config = require('../config');

const CACHE = path.join(__dirname, '..', '..', 'data', 'export-stock');
const COST_PERCENT = 0.15; // round trip, stock convention
const HOLD_DAYS = 14;
const ATR_STOP = 1.5;
// Hardcoded rather than read from config.alertStockKinds, which this test's own
// result emptied. Reading it live would make the script silently measure nothing
// and "confirm" the conclusion by producing no data — exactly the failure mode
// the cached-candle unwrapping bug above already caused once.
const ENABLED = ['momentum', 'cup-forming', 'golden-cross', 'ob-bullish'];

async function candlesFor(symbol) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `${symbol}.json`);
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* refetch */ }
  }
  // getChart returns { candles: [...] }, not a bare array. Unwrapping it here
  // rather than trusting the shape: the first run of this script assumed an
  // array, so `candles.length` was undefined, the `< 300` guard passed, nothing
  // could be iterated, and it reported n=0 across 91 symbols as though there
  // were genuinely no signals — a silent wrong answer rather than an error.
  const raw = await getChart(symbol, '10y', '1d');
  const candles = Array.isArray(raw) ? raw : (raw?.candles ?? []);
  if (candles.length > 300) fs.writeFileSync(file, JSON.stringify(candles));
  return candles;
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
  if (n < 2) return { n, avgR: null, t: null, win: null };
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1));
  return {
    n,
    avgR: Math.round(m * 1000) / 1000,
    t: Math.round((m / (sd / Math.sqrt(n))) * 100) / 100,
    win: Math.round((v.filter((x) => x > 0).length / n) * 1000) / 10,
  };
}

let seed = 5;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

async function main() {
  const universe = getUniverse();
  const symbols = (Array.isArray(universe) ? universe : []).map((u) => (typeof u === 'string' ? u : u.symbol));
  console.log(`universe: ${symbols.length} symbols, ${HOLD_DAYS}d hold, ${COST_PERCENT}% cost, kinds: ${ENABLED.join(', ')}\n`);

  const noConf = [];
  const withConf = [];
  const byKind = {};
  const random = [];
  const timed = [];
  let used = 0;

  for (const symbol of symbols) {
    let candles;
    try { candles = await candlesFor(symbol); } catch (err) { continue; }
    if (!candles || candles.length < 300) continue;
    used += 1;

    const occ = walkForwardOccurrences(candles);
    const dayCounts = new Map();
    for (const kind of ENABLED) {
      for (const hit of occ[kind] || []) dayCounts.set(hit.index, (dayCounts.get(hit.index) || 0) + 1);
    }

    let fires = 0;
    for (const kind of ENABLED) {
      for (const hit of occ[kind] || []) {
        const r = simulate(candles, hit.index);
        if (r === null) continue;
        fires += 1;
        noConf.push(r);
        (byKind[kind] ||= { all: [], conf: [] }).all.push(r);
        if ((dayCounts.get(hit.index) || 0) >= 2) {
          withConf.push(r);
          byKind[kind].conf.push(r);
          timed.push({ t: candles[hit.index].time, v: r });
        }
      }
    }
    // Random control at the same rate, same symbol and window.
    for (let k = 0; k < Math.min(fires, 40); k++) {
      const i = 260 + Math.floor(rnd() * (candles.length - 260 - HOLD_DAYS - 1));
      const r = simulate(candles, i);
      if (r !== null) random.push(r);
    }
    if (used % 15 === 0) process.stdout.write(`${used} `);
  }

  console.log(`\n\nsymbols used: ${used}\n`);
  console.log('  no confluence (what ships today) ', JSON.stringify(stat(noConf)));
  console.log('  confluence >= 2                  ', JSON.stringify(stat(withConf)));
  console.log('  RANDOM entry, same hold          ', JSON.stringify(stat(random)));

  const a = stat(noConf); const b = stat(withConf); const r = stat(random);
  for (const [label, s] of [['no-conf', a], ['confluence', b]]) {
    if (s.avgR !== null && r.avgR !== null && s.t && r.t) {
      const se = Math.sqrt((s.avgR / s.t) ** 2 + (r.avgR / r.t) ** 2);
      const td = (s.avgR - r.avgR) / se;
      console.log(`  ${label} beats random by ${(s.avgR - r.avgR).toFixed(3)}R  (t ${td.toFixed(2)}) ` +
        `${Math.abs(td) > 2 ? '<= real' : '<= NOT significant'}`);
    }
  }

  console.log('\n  per kind (all -> with confluence):');
  for (const kind of ENABLED) {
    const k = byKind[kind];
    if (!k) continue;
    console.log(`    ${kind.padEnd(14)} ${JSON.stringify(stat(k.all))}  ->  ${JSON.stringify(stat(k.conf))}`);
  }

  if (timed.length > 40) {
    timed.sort((x, y) => x.t - y.t);
    const mid = Math.floor(timed.length / 2);
    console.log(`\n  confluence split-half: ${JSON.stringify(stat(timed.slice(0, mid).map((x) => x.v)))}`);
    console.log(`                         ${JSON.stringify(stat(timed.slice(mid).map((x) => x.v)))}`);
  }

  const perDay = withConf.length / (used * 10 * 252) * used;
  console.log(`\n  alert volume: confluence would fire ~${(withConf.length / noConf.length * 100).toFixed(0)}% as often as today` +
    ` (${noConf.length} -> ${withConf.length} over 10y)`);
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { main };
