// Pairs trading backtest — the one side-strategy candidate whose alpha does
// NOT come from the same beta-to-BTC factor every other signal in this bot
// shares. Long the underperformer, short the outperformer, betting their
// historical relationship reasserts itself.
//
// Three things make this easy to fool yourself with, so each is handled
// explicitly:
//
// 1. MULTIPLE TESTING. 12 assets = 66 possible pairs. Testing all of them and
//    reporting the best is guaranteed to find something regardless of whether
//    an edge exists. So: pairs are SELECTED on the first half of history and
//    TRADED only on the second half. The out-of-sample number is the only one
//    that counts. The in-sample number is reported alongside purely to show
//    how big the selection illusion is.
//
// 2. PARAMETER OVERFITTING. A grid of lookback/entry-z is swept and ALL cells
//    are reported, not the best. A real effect shows up broadly; an artifact
//    lives in one magic cell.
//
// 3. COST. Two legs means double the fees — 0.25% round trip per leg = 0.5%
//    per trade, applied to every result. Pairs trades also tend to be smaller
//    in magnitude than directional ones, so this hurdle is proportionally
//    much higher than for the cup-forming setup.
//
// No look-ahead: the rolling mean/std at bar i uses only bars up to and
// including i, and entry happens at that same bar's close.
//
// VERDICT: REJECTED — not wired into any live alert. On the 12 large-cap
// pairs it looked genuinely good (out-of-sample +1.4% net/trade, 61% win
// rate, a coherent parameter PLATEAU rather than one lucky cell, stable
// across an OOS time-split, breakeven only at ~1.9% round-trip cost). Run on
// 18 mid-cap pairs never touched by this analysis — 153 pairs, n=6292,
// eight times the data — it collapses to -1.77% net, 50.1% win rate, and is
// negative even BEFORE costs (-1.27% gross), with only 29/91 selected pairs
// profitable. See data/crypto-signal-validation.md for the full write-up and
// why survivorship bias is the most likely explanation.

const { getDailyCandles } = require('../crypto/okx');
const { DEFAULT_VALIDATION_UNIVERSE } = require('../crypto/universe');

const ROUND_TRIP_COST_PERCENT = 0.5; // 0.25% per leg, two legs
const MAX_HOLD_DAYS = 20;
const STOP_Z = 3.5; // relationship considered broken, not merely stretched
const EXIT_Z = 0.0; // mean reversion complete

function log(...args) {
  console.log(...args);
}

async function fetchAll(symbols) {
  const data = {};
  for (const symbol of symbols) {
    try {
      const candles = await getDailyCandles(symbol, 730);
      if (candles && candles.length > 200) data[symbol] = candles;
      else log(`[pairsTrading] ${symbol}: only ${candles?.length ?? 0} candles, excluded`);
    } catch (err) {
      log(`[pairsTrading] skip ${symbol}: ${err.message}`);
    }
  }
  return data;
}

// Different listing dates mean different histories — intersect on timestamp
// so both legs of every pair are genuinely simultaneous.
function alignPair(candlesA, candlesB) {
  const mapB = new Map(candlesB.map((c) => [c.time, c.close]));
  const times = [];
  const a = [];
  const b = [];
  for (const c of candlesA) {
    const closeB = mapB.get(c.time);
    if (closeB > 0 && c.close > 0) {
      times.push(c.time);
      a.push(c.close);
      b.push(closeB);
    }
  }
  return { times, a, b };
}

function correlationOfReturns(a, b) {
  const ra = [];
  const rb = [];
  for (let i = 1; i < a.length; i++) {
    ra.push(Math.log(a[i] / a[i - 1]));
    rb.push(Math.log(b[i] / b[i - 1]));
  }
  const n = ra.length;
  if (n < 30) return null;
  const ma = ra.reduce((x, y) => x + y, 0) / n;
  const mb = rb.reduce((x, y) => x + y, 0) / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb);
    va += (ra[i] - ma) ** 2;
    vb += (rb[i] - mb) ** 2;
  }
  if (va <= 0 || vb <= 0) return null;
  return cov / Math.sqrt(va * vb);
}

// Trade the log spread. Dollar-neutral (equal notional per leg) rather than
// beta-hedged: fewer fitted parameters, so less to overfit.
function runPair({ times, a, b }, { lookback, entryZ, startIndex = 0, endIndex = null }) {
  const spread = a.map((_, i) => Math.log(a[i]) - Math.log(b[i]));
  const last = endIndex ?? spread.length;
  const trades = [];
  let i = Math.max(lookback, startIndex);

  while (i < last) {
    const window = spread.slice(i - lookback + 1, i + 1); // known at close of i
    const mean = window.reduce((x, y) => x + y, 0) / window.length;
    const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / window.length;
    const sd = Math.sqrt(variance);
    if (!(sd > 0)) { i += 1; continue; }
    const z = (spread[i] - mean) / sd;

    // direction = +1 means long A / short B (A is cheap relative to B)
    let direction = 0;
    if (z <= -entryZ) direction = 1;
    else if (z >= entryZ) direction = -1;
    if (direction === 0) { i += 1; continue; }

    const entryIdx = i;
    const riskSd = (STOP_Z - entryZ) * sd; // spread distance to the stop = 1R
    let exitIdx = null;
    let reason = 'timeout';

    for (let j = entryIdx + 1; j < Math.min(last, entryIdx + 1 + MAX_HOLD_DAYS); j++) {
      const w = spread.slice(j - lookback + 1, j + 1);
      const m = w.reduce((x, y) => x + y, 0) / w.length;
      const v = w.reduce((s, val) => s + (val - m) ** 2, 0) / w.length;
      const s = Math.sqrt(v);
      if (!(s > 0)) continue;
      const zj = (spread[j] - m) / s;
      if (direction === 1) {
        if (zj <= -STOP_Z) { exitIdx = j; reason = 'stop'; break; }
        if (zj >= EXIT_Z) { exitIdx = j; reason = 'target'; break; }
      } else {
        if (zj >= STOP_Z) { exitIdx = j; reason = 'stop'; break; }
        if (zj <= EXIT_Z) { exitIdx = j; reason = 'target'; break; }
      }
    }
    if (exitIdx === null) exitIdx = Math.min(last - 1, entryIdx + MAX_HOLD_DAYS);
    if (exitIdx <= entryIdx) break;

    const legA = (a[exitIdx] / a[entryIdx] - 1) * 100;
    const legB = (b[exitIdx] / b[entryIdx] - 1) * 100;
    const gross = direction === 1 ? legA - legB : legB - legA;
    const net = gross - ROUND_TRIP_COST_PERCENT;
    const spreadMove = direction === 1 ? spread[exitIdx] - spread[entryIdx] : spread[entryIdx] - spread[exitIdx];
    trades.push({
      entryTime: times[entryIdx],
      holdDays: exitIdx - entryIdx,
      grossPercent: gross,
      netPercent: net,
      r: riskSd > 0 ? spreadMove / riskSd : null,
      reason,
    });

    i = exitIdx + 1; // no overlapping positions in the same pair
  }
  return trades;
}

function summarize(trades) {
  const n = trades.length;
  if (!n) return { trades: 0, winRate: null, avgNetPercent: null, avgR: null, medianHold: null };
  const wins = trades.filter((t) => t.netPercent > 0).length;
  const rs = trades.map((t) => t.r).filter((r) => Number.isFinite(r));
  const holds = trades.map((t) => t.holdDays).sort((x, y) => x - y);
  return {
    trades: n,
    winRate: Math.round((wins / n) * 1000) / 10,
    avgNetPercent: Math.round((trades.reduce((s, t) => s + t.netPercent, 0) / n) * 1000) / 1000,
    avgR: rs.length ? Math.round((rs.reduce((s, r) => s + r, 0) / rs.length) * 1000) / 1000 : null,
    medianHold: holds[Math.floor(holds.length / 2)],
    stoppedPercent: Math.round((trades.filter((t) => t.reason === 'stop').length / n) * 1000) / 10,
  };
}

async function run() {
  const data = await fetchAll(DEFAULT_VALIDATION_UNIVERSE);
  const symbols = Object.keys(data);
  log(`\n[pairsTrading] ${symbols.length} symbols with sufficient history\n`);

  // Build every pair, aligned, with a split point at the midpoint of the
  // overlapping history.
  const pairs = [];
  for (let x = 0; x < symbols.length; x++) {
    for (let y = x + 1; y < symbols.length; y++) {
      const aligned = alignPair(data[symbols[x]], data[symbols[y]]);
      if (aligned.times.length < 300) continue;
      const mid = Math.floor(aligned.times.length / 2);
      pairs.push({
        name: `${symbols[x]}/${symbols[y]}`,
        aligned,
        mid,
        corrFirstHalf: correlationOfReturns(aligned.a.slice(0, mid), aligned.b.slice(0, mid)),
      });
    }
  }
  log(`[pairsTrading] ${pairs.length} pairs with >=300 overlapping days\n`);

  const grid = [];
  for (const lookback of [20, 30, 60]) {
    for (const entryZ of [1.5, 2.0, 2.5]) {
      grid.push({ lookback, entryZ });
    }
  }

  const results = [];
  for (const params of grid) {
    // IN-SAMPLE: every pair, first half. Used ONLY for selection.
    const inSampleAll = [];
    const perPairInSample = new Map();
    for (const p of pairs) {
      const t = runPair(p.aligned, { ...params, startIndex: 0, endIndex: p.mid });
      perPairInSample.set(p.name, t);
      inSampleAll.push(...t);
    }

    // SELECT: pairs that were both well-correlated and profitable in-sample.
    const selected = pairs.filter((p) => {
      const t = perPairInSample.get(p.name) || [];
      if (t.length < 5) return false;
      if (!(p.corrFirstHalf > 0.5)) return false;
      const avg = t.reduce((s, x) => s + x.netPercent, 0) / t.length;
      return avg > 0;
    });

    // OUT-OF-SAMPLE: only selected pairs, only second half. The real test.
    const oosAll = [];
    for (const p of selected) {
      oosAll.push(...runPair(p.aligned, { ...params, startIndex: p.mid, endIndex: p.aligned.times.length }));
    }

    // CONTROL: all pairs traded on the second half, ignoring selection —
    // shows whether selection added anything at all.
    const oosUnselected = [];
    for (const p of pairs) {
      oosUnselected.push(...runPair(p.aligned, { ...params, startIndex: p.mid, endIndex: p.aligned.times.length }));
    }

    results.push({
      params,
      selectedCount: selected.length,
      inSample: summarize(inSampleAll),
      outOfSample: summarize(oosAll),
      oosNoSelection: summarize(oosUnselected),
    });
  }

  return { results, pairCount: pairs.length, symbols };
}

if (require.main === module) {
  run().then(({ results, pairCount }) => {
    console.log(`=== Pairs trading, ${pairCount} pairs, cost ${ROUND_TRIP_COST_PERCENT}% round trip (2 legs) ===`);
    console.log(`Compare against the cup-forming benchmark: 0.497R\n`);
    console.log(
      'lookback'.padStart(9), 'entryZ'.padStart(7), 'sel'.padStart(5),
      '| IN-SAMPLE (selection bias)'.padEnd(34),
      '| OUT-OF-SAMPLE (real)'.padEnd(34),
      '| OOS no selection',
    );
    for (const r of results) {
      const fmt = (s) => `n=${String(s.trades).padStart(4)} wr=${String(s.winRate ?? '-').padStart(5)}% net=${String(s.avgNetPercent ?? '-').padStart(7)}%`;
      console.log(
        String(r.params.lookback).padStart(9),
        String(r.params.entryZ).padStart(7),
        String(r.selectedCount).padStart(5),
        '|', fmt(r.inSample),
        '|', fmt(r.outOfSample),
        '|', fmt(r.oosNoSelection),
      );
    }

    console.log(`\n=== R-multiples (out-of-sample, selected pairs) ===`);
    for (const r of results) {
      console.log(
        `lookback ${String(r.params.lookback).padStart(2)} entryZ ${r.params.entryZ}: ` +
        `avgR ${String(r.outOfSample.avgR ?? '-').padStart(7)}  ` +
        `stopped ${String(r.outOfSample.stoppedPercent ?? '-').padStart(5)}%  ` +
        `median hold ${String(r.outOfSample.medianHold ?? '-').padStart(3)}d`,
      );
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run, runPair, alignPair, correlationOfReturns };
