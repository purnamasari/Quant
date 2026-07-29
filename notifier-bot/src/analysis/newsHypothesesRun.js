// Runs the pre-registered suite in src/analysis/newsHypotheses.js.
// Hypotheses, horizons and the pass mark are fixed there; nothing in this file
// chooses what counts as a result.

const H = require('./newsHypotheses');

const HOUR = 3600000;

// H5 needs a control: the same measurement on days with no release, so
// "volatility rose" can be separated from "volatility is always like this".
function baselineWindows(candles, count, spanMs) {
  const out = [];
  const step = Math.max(1, Math.floor(candles.length / (count + 2)));
  for (let i = step; i + 2 < candles.length && out.length < count; i += step) {
    const start = candles[i];
    const end = H.barAt(candles, start.time + spanMs);
    if (end && end.time > start.time) out.push(Math.abs(H.pct(start.close, end.close)));
  }
  return out;
}

async function runCrypto(events, symbol, log) {
  const rows = [];
  for (const ev of events) {
    const candles = await H.fetchCryptoMinutes(symbol, ev.releaseMs);
    if (candles.length < 60) continue;
    const base = H.barAt(candles, ev.releaseMs - 60000);
    const b1 = H.barAt(candles, ev.releaseMs + 60000);
    const b5 = H.barAt(candles, ev.releaseMs + 5 * 60000);
    const b15 = H.barAt(candles, ev.releaseMs + 15 * 60000);
    const b60 = H.barAt(candles, ev.releaseMs + 60 * 60000);
    if (!base || !b1 || !b5 || !b60) continue;
    const sign = ev.expected;

    // H2: first post-release bar that is quiet (range below the trailing
    // median) AND closes with the surprise. Mechanical, so it can be wrong.
    let cleanEntry = null;
    let cleanMinute = null;
    const post = candles.filter((c) => c.time > ev.releaseMs && c.time <= ev.releaseMs + 30 * 60000);
    for (const c of post) {
      const idx = candles.indexOf(c);
      const prior = candles.slice(Math.max(0, idx - H.CLEAN_LOOKBACK), idx);
      if (prior.length < H.CLEAN_LOOKBACK) continue;
      const ranges = prior.map((p) => p.high - p.low).sort((a, b) => a - b);
      const median = ranges[Math.floor(ranges.length / 2)];
      const quiet = (c.high - c.low) < median;
      const agrees = sign > 0 ? c.close > c.open : c.close < c.open;
      if (quiet && agrees) { cleanEntry = c; cleanMinute = Math.round((c.time - ev.releaseMs) / 60000); break; }
    }

    const first5Dir = Math.sign(H.pct(base.close, b5.close));
    rows.push({
      key: ev.key,
      releaseMs: ev.releaseMs,
      surpriseSize: Math.abs(ev.actual - ev.consensus) / (Math.abs(ev.consensus) || 1),
      h1_15m: H.pct(base.close, b15 ? b15.close : b5.close) * sign,
      h1_60m: H.pct(base.close, b60.close) * sign,
      naive_1m_to_60m: H.pct(b1.close, b60.close) * sign,
      h2_clean: cleanEntry ? H.pct(cleanEntry.close, b60.close) * sign : null,
      h2_minute: cleanMinute,
      h3_momentum: first5Dir !== 0 ? H.pct(b5.close, b60.close) * first5Dir : null,
      h4_fade: first5Dir !== 0 ? -H.pct(b5.close, b60.close) * first5Dir : null,
      h5_absMove: Math.abs(H.pct(base.close, b60.close)),
    });
    log(`.`);
    await H.sleep(120);
  }
  return rows;
}

function runStocks(events, candles) {
  const rows = [];
  for (const ev of events) {
    const base = H.barAt(candles, ev.releaseMs - HOUR);
    const h1 = H.barAt(candles, ev.releaseMs + HOUR);
    const h2 = H.barAt(candles, ev.releaseMs + 2 * HOUR);
    if (!base || !h1 || !h2) continue;
    // Hourly bars: skip events whose surrounding bars are far away, which
    // happens for releases outside the cash session.
    if (Math.abs(h1.time - (ev.releaseMs + HOUR)) > 2 * HOUR) continue;
    const sign = ev.expected;
    const firstDir = Math.sign(H.pct(base.close, h1.close));
    rows.push({
      key: ev.key,
      releaseMs: ev.releaseMs,
      surpriseSize: Math.abs(ev.actual - ev.consensus) / (Math.abs(ev.consensus) || 1),
      h1_1h: H.pct(base.close, h1.close) * sign,
      h1_2h: H.pct(base.close, h2.close) * sign,
      h3_momentum: firstDir !== 0 ? H.pct(h1.close, h2.close) * firstDir : null,
      h4_fade: firstDir !== 0 ? -H.pct(h1.close, h2.close) * firstDir : null,
      h5_absMove: Math.abs(H.pct(base.close, h2.close)),
    });
  }
  return rows;
}

function splitHalves(rows) {
  const sorted = [...rows].sort((a, b) => a.releaseMs - b.releaseMs);
  const mid = Math.floor(sorted.length / 2);
  return [sorted.slice(0, mid), sorted.slice(mid)];
}

function reportSplit(label, rows, field) {
  const [a, b] = splitHalves(rows);
  const sa = H.stat(a.map((r) => r[field]));
  const sb = H.stat(b.map((r) => r[field]));
  console.log(`      first half:  n=${sa.n} mean=${sa.mean}% t=${sa.t}   |   second half: n=${sb.n} mean=${sb.mean}% t=${sb.t}`);
}

async function main() {
  const days = Number(process.argv[2]) || 730;
  console.log(`Collecting macro releases over ${days} days (calendar is disk-cached)...`);
  const raw = await H.collect({ days, log: () => {} });
  const { events, conflicts, collapsed } = H.dedupeEvents(raw);
  console.log(`${raw.length} raw releases -> ${events.length} independent observations`);
  console.log(`  excluded ${conflicts} for opposite-direction simultaneity, collapsed ${collapsed} same-direction duplicates\n`);
  if (events.length < 20) { console.log('too few events to test anything'); return; }

  // ------------------------------------------------------------- CRYPTO
  const cryptoRows = {};
  for (const symbol of H.CRYPTO_SYMBOLS) {
    process.stdout.write(`Fetching ${symbol} 1m windows`);
    cryptoRows[symbol] = await runCrypto(events, symbol, (c) => process.stdout.write(c));
    console.log(` ${cryptoRows[symbol].length} usable`);
  }

  // ------------------------------------------------------------- STOCKS
  const stockRows = {};
  for (const symbol of H.STOCK_SYMBOLS) {
    try {
      const candles = await H.fetchStockHourly(symbol);
      stockRows[symbol] = runStocks(events, candles);
      console.log(`${symbol}: ${candles.length} hourly bars -> ${stockRows[symbol].length} usable events`);
    } catch (err) {
      console.log(`${symbol}: ${err.message}`);
      stockRows[symbol] = [];
    }
    await H.sleep(400);
  }

  console.log(`\n${'='.repeat(78)}`);
  console.log(`Bonferroni threshold for 14 tests: |t| > ${H.BONFERRONI_T}`);
  console.log('='.repeat(78));

  console.log('\n### H1 — directional drift (surprise-implied direction)\n');
  for (const [sym, rows] of Object.entries(cryptoRows)) {
    console.log(H.line(`${sym} +15m`, H.stat(rows.map((r) => r.h1_15m))));
    console.log(H.line(`${sym} +60m`, H.stat(rows.map((r) => r.h1_60m))));
    if (rows.length > 20) reportSplit(sym, rows, 'h1_60m');
  }
  for (const [sym, rows] of Object.entries(stockRows)) {
    if (!rows.length) continue;
    console.log(H.line(`${sym} +1h`, H.stat(rows.map((r) => r.h1_1h))));
    console.log(H.line(`${sym} +2h`, H.stat(rows.map((r) => r.h1_2h))));
    if (rows.length > 20) reportSplit(sym, rows, 'h1_2h');
  }

  console.log('\n### H2 — clean-candle entry (crypto only; needs 1m bars)\n');
  for (const [sym, rows] of Object.entries(cryptoRows)) {
    const filled = rows.filter((r) => r.h2_clean !== null);
    console.log(H.line(`${sym} clean entry -> +60m`, H.stat(filled.map((r) => r.h2_clean))));
    console.log(H.line(`${sym} naive +1m -> +60m`, H.stat(rows.map((r) => r.naive_1m_to_60m))));
    console.log(`     triggered on ${filled.length}/${rows.length} events, median entry +${(() => {
      const ms = filled.map((r) => r.h2_minute).sort((a, b) => a - b);
      return ms.length ? ms[Math.floor(ms.length / 2)] : '-';
    })()}m`);
  }

  console.log('\n### H3 / H4 — momentum continuation vs fade (direction-agnostic)\n');
  for (const [sym, rows] of Object.entries(cryptoRows)) {
    console.log(H.line(`${sym} momentum`, H.stat(rows.map((r) => r.h3_momentum))));
    console.log(H.line(`${sym} fade`, H.stat(rows.map((r) => r.h4_fade))));
  }
  for (const [sym, rows] of Object.entries(stockRows)) {
    if (!rows.length) continue;
    console.log(H.line(`${sym} momentum`, H.stat(rows.map((r) => r.h3_momentum))));
    console.log(H.line(`${sym} fade`, H.stat(rows.map((r) => r.h4_fade))));
  }

  console.log('\n### H5 — volatility expansion vs non-event baseline\n');
  for (const [sym, rows] of Object.entries(cryptoRows)) {
    const evAbs = H.stat(rows.map((r) => r.h5_absMove));
    const sample = await H.fetchCryptoMinutes(sym, Date.now() - 5 * 86400000);
    const base = H.stat(baselineWindows(sample, 40, 60 * 60000));
    console.log(`  ${sym.padEnd(10)} event |move| ${evAbs.mean}% (n=${evAbs.n})  vs baseline ${base.mean}% (n=${base.n})  ratio ${base.mean ? H.round(evAbs.mean / base.mean, 2) : '-'}x`);
  }
  for (const [sym, rows] of Object.entries(stockRows)) {
    if (!rows.length) continue;
    const evAbs = H.stat(rows.map((r) => r.h5_absMove));
    console.log(`  ${sym.padEnd(10)} event |move| ${evAbs.mean}% (n=${evAbs.n})`);
  }

  console.log('\n### H6 — does surprise magnitude matter?\n');
  for (const [sym, rows] of Object.entries(cryptoRows)) {
    const sorted = [...rows].filter((r) => Number.isFinite(r.surpriseSize)).sort((a, b) => a.surpriseSize - b.surpriseSize);
    const third = Math.floor(sorted.length / 3);
    if (third < 5) { console.log(`  ${sym}: too few events to bucket`); continue; }
    console.log(H.line(`${sym} small surprise`, H.stat(sorted.slice(0, third).map((r) => r.h1_60m))));
    console.log(H.line(`${sym} large surprise`, H.stat(sorted.slice(-third).map((r) => r.h1_60m))));
  }

  console.log('\n### H7 — do stocks and crypto agree on the same release?\n');
  const btc = cryptoRows['BTC-USDT'] || [];
  const spy = stockRows.SPY || [];
  const byTime = new Map(spy.map((r) => [r.releaseMs, r]));
  const paired = btc.map((b) => ({ b, s: byTime.get(b.releaseMs) })).filter((p) => p.s);
  if (paired.length > 10) {
    const agree = paired.filter((p) => Math.sign(p.b.h1_60m) === Math.sign(p.s.h1_2h)).length;
    console.log(`  paired events: ${paired.length}, same sign: ${agree} (${H.round((agree / paired.length) * 100, 1)}%)`);
    console.log(`  (50% = independent; well above = crypto is following equities, not reacting on its own)`);
  } else {
    console.log(`  only ${paired.length} paired events — not enough overlap to say`);
  }
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
