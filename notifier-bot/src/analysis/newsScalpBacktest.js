// Can the reaction to a macro release actually be scalped?
//
// Not "can we predict the number" — consensus is already the best available
// forecast, produced by hundreds of professional economists, and we hold no
// information they lack. The answerable question is narrower and more useful:
// once the number is public, is there a directional move left that a human
// clicking a button can still capture?
//
// That reduces to one measurement: HOW FAST does the move happen. If most of
// it lands in the first sixty seconds it belongs to co-located machines and no
// retail entry can reach it. If it keeps going for fifteen or thirty minutes,
// there is a window.
//
// So this measures the capture curve rather than just "does price move":
//   - the full move over 60 minutes from the release
//   - the share of it already gone by minute 1, 2 and 5
//   - what a realistic entry (at the close of minute +1, +2, +5) still gets
//   - how often the first minute's direction REVERSES, which is what turns a
//     correct read into a stopped-out trade
//
// Direction comes from the surprise: actual versus consensus. For inflation
// prints hotter is risk-off, so the expected crypto direction is down; that
// mapping lives in SURPRISE_DIRECTION below rather than being assumed.
//
// Data notes: Nasdaq's calendar field named `gmt` actually carries Eastern
// time (see src/time.js), so every release timestamp goes through etToUtc.
// OKX serves 1m history for old dates via history-candles, verified back at
// least 2.5 months. Calendar days are cached to disk — the API throttles, and
// a re-run should not re-pay for it.

const fs = require('node:fs');
const path = require('node:path');
const { etToUtc } = require('../time');
const { parseValue } = require('../macro');

const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'macro-cache');
const SYMBOL = 'BTC-USDT';
const MINUTES_BEFORE = 15;
const MINUTES_AFTER = 60;
const CALENDAR_PAUSE_MS = 1500;

// Releases worth testing, and which way a HIGHER-than-consensus print is
// expected to push crypto. 'down' = hotter inflation / stronger economy reads
// as tighter policy, which is risk-off. Labour data is deliberately included
// with the same sign but is the least reliable — strong jobs can read as
// growth-positive instead, and that ambiguity is part of what gets measured.
const SURPRISE_DIRECTION = {
  'core cpi': 'down',
  'cpi': 'down',
  'core pce': 'down',
  'pce': 'down',
  'ppi': 'down',
  'nonfarm payroll': 'down',
  'non-farm payroll': 'down',
  'unemployment rate': 'up', // higher unemployment = weaker economy = easier policy
  'initial jobless claims': 'up',
  'retail sales': 'down',
  'fed interest rate decision': 'down',
};

function matchEvent(name) {
  const lower = name.toLowerCase();
  const key = Object.keys(SURPRISE_DIRECTION).find((k) => lower.includes(k));
  return key ? { key, expected: SURPRISE_DIRECTION[key] } : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cachePath(dateYmd) {
  return path.join(CACHE_DIR, `${dateYmd}.json`);
}

async function calendarForDate(dateYmd, log) {
  const file = cachePath(dateYmd);
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch { /* fall through and refetch */ }
  }
  const url = `https://api.nasdaq.com/api/calendar/economicevents?date=${dateYmd}`;
  let rows = null;
  for (let attempt = 1; attempt <= 3 && rows === null; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.rows) rows = json.data.rows;
      }
    } catch { /* retry */ }
    if (rows === null) await sleep(CALENDAR_PAUSE_MS * attempt);
  }
  // A weekend or holiday genuinely has no rows; cache [] either way so the
  // harvest does not re-request it forever. Throttled days look identical,
  // which is why the harvest reports how many days came back empty.
  const value = rows || [];
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
  if (log) log(`[newsScalp] fetched ${dateYmd}: ${value.length} rows`);
  await sleep(CALENDAR_PAUSE_MS);
  return value;
}

// 1m candles covering [release - MINUTES_BEFORE, release + MINUTES_AFTER].
// history-candles pages backwards from `after`, so one call anchored just past
// the window end covers it when the span is under 100 bars.
async function candlesAround(releaseMs) {
  const endMs = releaseMs + (MINUTES_AFTER + 1) * 60000;
  const url = `https://www.okx.com/api/v5/market/history-candles?instId=${SYMBOL}&bar=1m&limit=100&after=${endMs}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const rows = json?.data || [];
  if (!rows.length) return null;
  return rows
    .map((r) => ({ time: Number(r[0]), open: +r[1], high: +r[2], low: +r[3], close: +r[4] }))
    .sort((a, b) => a.time - b.time);
}

function closeAt(candles, ms) {
  // The candle whose minute contains ms — its close is the price once that
  // minute has finished, i.e. the earliest moment that price is actionable.
  let best = null;
  for (const c of candles) {
    if (c.time <= ms) best = c;
    else break;
  }
  return best;
}

function pctMove(from, to) {
  return from > 0 ? ((to - from) / from) * 100 : null;
}

async function collect({ days = 180, log = console.log } = {}) {
  const events = [];
  const today = new Date();
  let emptyDays = 0;
  for (let d = 1; d <= days; d++) {
    const day = new Date(today.getTime() - d * 86400000);
    const ymd = day.toISOString().slice(0, 10);
    const dow = day.getUTCDay();
    if (dow === 0 || dow === 6) continue; // no US releases at weekends
    const rows = await calendarForDate(ymd, log);
    if (!rows.length) { emptyDays += 1; continue; }
    for (const r of rows) {
      if (r.country !== 'United States') continue;
      const match = matchEvent(r.eventName);
      if (!match) continue;
      const actual = parseValue(r.actual);
      const consensus = parseValue(r.consensus);
      if (actual === null || consensus === null) continue;
      if (actual === consensus) continue; // no surprise, nothing to trade
      const releaseUtc = etToUtc(ymd, r.gmt);
      if (!releaseUtc) continue;
      const surpriseUp = actual > consensus;
      // Expected crypto direction: +1 long, -1 short.
      const expected = match.expected === 'down'
        ? (surpriseUp ? -1 : 1)
        : (surpriseUp ? 1 : -1);
      events.push({
        date: ymd, name: r.eventName, key: match.key,
        actual, consensus, surpriseUp, expected,
        releaseMs: releaseUtc.getTime(),
      });
    }
  }
  log(`[newsScalp] ${events.length} surprise releases found; ${emptyDays} days returned no rows`);
  return events;
}

async function measure(events, { log = console.log } = {}) {
  const samples = [];
  for (const ev of events) {
    const candles = await candlesAround(ev.releaseMs);
    if (!candles) continue;
    const base = closeAt(candles, ev.releaseMs - 60000); // last close BEFORE the release minute
    if (!base) continue;
    const at = (mins) => closeAt(candles, ev.releaseMs + mins * 60000);
    const c1 = at(1); const c2 = at(2); const c5 = at(5);
    const c15 = at(15); const c30 = at(30); const c60 = at(60);
    if (!c1 || !c60) continue;

    const releaseMinute = closeAt(candles, ev.releaseMs);
    const rangePct = releaseMinute && releaseMinute.low > 0
      ? ((releaseMinute.high - releaseMinute.low) / releaseMinute.low) * 100
      : null;

    // Signed by the expected direction, so a positive number means the
    // surprise pushed price the way theory says it should.
    const signed = (candle) => (candle ? pctMove(base.close, candle.close) * ev.expected : null);

    samples.push({
      ...ev,
      releaseRangePct: rangePct,
      m1: signed(c1), m2: signed(c2), m5: signed(c5),
      m15: signed(c15), m30: signed(c30), m60: signed(c60),
      // What a realistic entry captures: enter at the close of minute +N,
      // exit at +60. This is the number that decides whether it is scalpable.
      fromM1: c1 ? pctMove(c1.close, c60.close) * ev.expected : null,
      fromM2: c2 ? pctMove(c2.close, c60.close) * ev.expected : null,
      fromM5: c5 ? pctMove(c5.close, c60.close) * ev.expected : null,
      // Did the first minute's direction hold?
      firstMinuteDir: c1 ? Math.sign(pctMove(base.close, c1.close)) : 0,
      sixtyMinDir: Math.sign(pctMove(base.close, c60.close)),
    });
    log(`[newsScalp] ${ev.date} ${ev.name.slice(0, 28)} m1=${samples[samples.length - 1].m1?.toFixed(2)}%`);
    await sleep(150);
  }
  return samples;
}

function stats(values) {
  const xs = values.filter((v) => Number.isFinite(v));
  if (!xs.length) return { n: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const pos = xs.filter((v) => v > 0).length;
  return {
    n: xs.length,
    mean: Math.round(mean * 1000) / 1000,
    hitRate: Math.round((pos / xs.length) * 1000) / 10,
  };
}

if (require.main === module) {
  const days = Number(process.argv[2]) || 180;
  (async () => {
    const events = await collect({ days });
    if (!events.length) { console.log('no events collected'); return; }
    const samples = await measure(events);
    console.log(`\n=== Macro-release reaction on ${SYMBOL}, ${samples.length} surprise releases ===`);
    console.log('Signed by the expected direction: positive = moved the way the surprise implies.\n');

    console.log('horizon from release   ', JSON.stringify(stats(samples.map((s) => s.m1))), ' <- +1m');
    for (const [label, k] of [['+2m ', 'm2'], ['+5m ', 'm5'], ['+15m', 'm15'], ['+30m', 'm30'], ['+60m', 'm60']]) {
      console.log(`horizon from release    ${JSON.stringify(stats(samples.map((s) => s[k])))}  <- ${label}`);
    }

    console.log('\n=== How much is LEFT after a realistic reaction delay (exit at +60m) ===');
    for (const [label, k] of [['enter at +1m', 'fromM1'], ['enter at +2m', 'fromM2'], ['enter at +5m', 'fromM5']]) {
      console.log(`  ${label}: ${JSON.stringify(stats(samples.map((s) => s[k])))}`);
    }

    const m1 = stats(samples.map((s) => s.m1)).mean;
    const m60 = stats(samples.map((s) => s.m60)).mean;
    if (Number.isFinite(m1) && Number.isFinite(m60) && m60 !== 0) {
      console.log(`\n  Share of the 60-minute move already gone by minute 1: ${Math.round((m1 / m60) * 100)}%`);
    }

    const reversals = samples.filter((s) => s.firstMinuteDir !== 0 && s.firstMinuteDir !== s.sixtyMinDir);
    console.log(`\n=== Whipsaw ===`);
    console.log(`  first-minute direction reversed by +60m: ${reversals.length}/${samples.length} ` +
      `(${Math.round((reversals.length / samples.length) * 1000) / 10}%)`);
    console.log(`  median release-minute range: ${(() => {
      const rs = samples.map((s) => s.releaseRangePct).filter(Number.isFinite).sort((a, b) => a - b);
      return rs.length ? rs[Math.floor(rs.length / 2)].toFixed(2) + '%' : 'n/a';
    })()} (spread widens most here — a market order pays it)`);

    console.log('\n=== By event type ===');
    const byKey = {};
    for (const s of samples) (byKey[s.key] ||= []).push(s);
    for (const [key, rows] of Object.entries(byKey).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${key.padEnd(24)} n=${String(rows.length).padStart(3)}  +1m ${JSON.stringify(stats(rows.map((r) => r.m1)))}  +60m ${JSON.stringify(stats(rows.map((r) => r.m60)))}`);
    }
  })().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { collect, measure, stats, SURPRISE_DIRECTION };
