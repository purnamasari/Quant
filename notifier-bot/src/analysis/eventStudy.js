// Per-event price-action dataset around macro releases.
//
// The scalp backtest reports aggregates; this stores the raw material behind
// them so individual events can be inspected and compared, and so any later
// analysis re-runs for free instead of re-fetching rate-limited APIs.
//
// What it keeps per event, and why each field earns its place:
//
//   metadata      date, name, release time in ET and UTC, actual, consensus,
//                 previous, surprise direction and size (in % of consensus)
//   pre-release   closes at -60/-30/-15/-5/-1m — shows whether price had
//                 already started moving, i.e. whether the number leaked into
//                 positioning before it was public
//   release bar   OHLC of the release minute plus its range — the range is the
//                 best available proxy for how far the spread blows out at
//                 exactly the moment you want to cross it
//   path          closes at +1/+2/+3/+5/+10/+15/+30/+45/+60m
//   MFE / MAE     the largest favourable and adverse excursions within the
//                 hour, measured from a realistic +1m entry. These two matter
//                 more than the end-point return for a scalper: MFE is what
//                 was actually on the table, MAE is how much heat you had to
//                 sit through to collect it. A strategy that closes early is
//                 leaving MFE behind; a stop that is too tight is being taken
//                 out by MAE on trades that would have worked.
//   volume        release-minute volume against the prior-hour average, so a
//                 "big reaction" can be separated from a thin-liquidity spike
//   raw candles   the full -15m..+60m 1m series, so nothing above has to be
//                 trusted on faith or recomputed from the network
//
// Everything is signed by the EXPECTED direction (see newsScalpBacktest.js),
// so positive always means "moved the way the surprise implies", whether the
// trade would have been long or short.

const fs = require('node:fs');
const path = require('node:path');
const { collect } = require('./newsScalpBacktest');

const OUT_DIR = path.join(__dirname, '..', '..', 'data', 'event-studies');
const MINUTES_BEFORE = 60;
const MINUTES_AFTER = 60;
const OFFSETS_BEFORE = [-60, -30, -15, -5, -1];
const OFFSETS_AFTER = [1, 2, 3, 5, 10, 15, 30, 45, 60];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Two pages of 1m history cover -60..+60 minutes (121 bars > the 100 cap).
async function fetchWindow(symbol, releaseMs) {
  const out = new Map();
  let anchor = releaseMs + (MINUTES_AFTER + 1) * 60000;
  for (let page = 0; page < 3; page++) {
    const url = `https://www.okx.com/api/v5/market/history-candles?instId=${symbol}&bar=1m&limit=100&after=${anchor}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const json = await res.json();
    const rows = json?.data || [];
    if (!rows.length) break;
    for (const r of rows) {
      out.set(Number(r[0]), {
        time: Number(r[0]),
        open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5],
      });
    }
    anchor = Number(rows[rows.length - 1][0]);
    if (anchor < releaseMs - (MINUTES_BEFORE + 2) * 60000) break;
    await sleep(150);
  }
  const candles = [...out.values()].sort((a, b) => a.time - b.time);
  return candles.filter((c) => c.time >= releaseMs - MINUTES_BEFORE * 60000
    && c.time <= releaseMs + MINUTES_AFTER * 60000);
}

function candleAt(candles, ms) {
  let best = null;
  for (const c of candles) {
    if (c.time <= ms) best = c;
    else break;
  }
  return best;
}

function pct(from, to) {
  return from > 0 ? Math.round(((to - from) / from) * 100 * 10000) / 10000 : null;
}

function buildStudy(event, candles, symbol) {
  const base = candleAt(candles, event.releaseMs - 60000); // last close before the release minute
  const releaseBar = candleAt(candles, event.releaseMs);
  if (!base || !releaseBar) return null;
  const sign = event.expected; // +1 long, -1 short

  const path_ = {};
  for (const m of OFFSETS_BEFORE) {
    const c = candleAt(candles, event.releaseMs + m * 60000);
    path_[`m${m}`] = c ? pct(base.close, c.close) * sign : null;
  }
  for (const m of OFFSETS_AFTER) {
    const c = candleAt(candles, event.releaseMs + m * 60000);
    path_[`p${m}`] = c ? pct(base.close, c.close) * sign : null;
  }

  // Excursions measured from a realistic +1m entry, over the following hour.
  const entryBar = candleAt(candles, event.releaseMs + 60000);
  const after = candles.filter((c) => c.time > event.releaseMs + 60000
    && c.time <= event.releaseMs + MINUTES_AFTER * 60000);
  let mfe = null;
  let mae = null;
  let mfeMinute = null;
  if (entryBar && after.length) {
    const entry = entryBar.close;
    let best = -Infinity;
    let worst = Infinity;
    for (const c of after) {
      // For a long the favourable extreme is the high; for a short it is the low.
      const fav = sign > 0 ? pct(entry, c.high) : -pct(entry, c.low);
      const adv = sign > 0 ? pct(entry, c.low) : -pct(entry, c.high);
      if (fav > best) { best = fav; mfeMinute = Math.round((c.time - event.releaseMs) / 60000); }
      if (adv < worst) worst = adv;
    }
    mfe = Math.round(best * 10000) / 10000;
    mae = Math.round(worst * 10000) / 10000;
  }

  const priorHour = candles.filter((c) => c.time < event.releaseMs && c.time >= event.releaseMs - 60 * 60000);
  const avgVol = priorHour.length ? priorHour.reduce((s, c) => s + c.volume, 0) / priorHour.length : null;

  return {
    symbol,
    date: event.date,
    name: event.name,
    key: event.key,
    releaseUtc: new Date(event.releaseMs).toISOString(),
    actual: event.actual,
    consensus: event.consensus,
    surpriseUp: event.surpriseUp,
    surprisePercentOfConsensus: event.consensus !== 0
      ? Math.round(((event.actual - event.consensus) / Math.abs(event.consensus)) * 1000) / 10
      : null,
    expectedDirection: sign > 0 ? 'long' : 'short',
    simultaneousWith: event.simultaneousWith || [],
    directionConflict: Boolean(event.directionConflict),
    basePrice: base.close,
    releaseBar: {
      open: releaseBar.open, high: releaseBar.high, low: releaseBar.low, close: releaseBar.close,
      rangePercent: releaseBar.low > 0
        ? Math.round(((releaseBar.high - releaseBar.low) / releaseBar.low) * 100 * 1000) / 1000
        : null,
      volumeVsPriorHour: avgVol ? Math.round((releaseBar.volume / avgVol) * 10) / 10 : null,
    },
    path: path_,
    entryAtPlus1m: entryBar ? entryBar.close : null,
    mfePercent: mfe,
    maePercent: mae,
    mfeAtMinute: mfeMinute,
    // How much of the hour's move was already gone by the +1m entry.
    capturedByMinute1Percent: path_.p60 && path_.p1 !== null && path_.p60 !== 0
      ? Math.round((path_.p1 / path_.p60) * 100)
      : null,
    candles,
  };
}

// CONFOUND, made explicit in the data rather than left to be discovered:
// US releases are heavily clustered at 08:30 ET, so several land in the same
// minute. Every one of them then gets credited with the identical price path.
// Worse, when two simultaneous releases imply OPPOSITE directions — as Core
// Retail Sales and Initial Jobless Claims did on 2026-07-17 — the same move is
// recorded once as a win and once as a loss, and any aggregate silently
// averages a coin flip it invented. Tagging the clash lets analysis exclude or
// group them instead of treating each as an independent observation.
function tagSimultaneous(events) {
  const byTime = new Map();
  for (const e of events) {
    if (!byTime.has(e.releaseMs)) byTime.set(e.releaseMs, []);
    byTime.get(e.releaseMs).push(e);
  }
  for (const group of byTime.values()) {
    if (group.length < 2) continue;
    const directions = new Set(group.map((e) => e.expected));
    for (const e of group) {
      e.simultaneousWith = group.filter((o) => o !== e).map((o) => o.name);
      // Directions disagree: the price move cannot be attributed to either.
      e.directionConflict = directions.size > 1;
    }
  }
  return events;
}

async function run({ days = 180, symbol = 'BTC-USDT', log = console.log } = {}) {
  const events = tagSimultaneous(await collect({ days, log }));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const studies = [];
  for (const event of events) {
    const slug = `${event.date}_${symbol.split('-')[0]}_${event.name.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 40)}`;
    const file = path.join(OUT_DIR, `${slug}.json`);
    if (fs.existsSync(file)) {
      try {
        studies.push(JSON.parse(fs.readFileSync(file, 'utf8')));
        continue;
      } catch { /* refetch on unreadable file */ }
    }
    const candles = await fetchWindow(symbol, event.releaseMs);
    if (candles.length < 30) { log(`[eventStudy] ${event.date} ${event.name}: only ${candles.length} candles, skipped`); continue; }
    const study = buildStudy(event, candles, symbol);
    if (!study) continue;
    fs.writeFileSync(file, JSON.stringify(study, null, 1));
    studies.push(study);
    log(`[eventStudy] ${event.date} ${event.name.slice(0, 30)} -> MFE ${study.mfePercent}% MAE ${study.maePercent}%`);
    await sleep(200);
  }
  return studies;
}

// Flat CSV so events can be sorted and compared in a spreadsheet.
function toCsv(studies) {
  const cols = [
    'date', 'symbol', 'name', 'key', 'releaseUtc', 'actual', 'consensus',
    'surprisePercentOfConsensus', 'expectedDirection', 'basePrice',
    'releaseRangePercent', 'volumeVsPriorHour',
    'p1', 'p2', 'p5', 'p15', 'p30', 'p60',
    'mfePercent', 'maePercent', 'mfeAtMinute', 'capturedByMinute1Percent',
    'directionConflict', 'simultaneousCount',
  ];
  const lines = [cols.join(',')];
  for (const s of studies) {
    lines.push([
      s.date, s.symbol, `"${s.name.replace(/"/g, "'")}"`, s.key, s.releaseUtc,
      s.actual, s.consensus, s.surprisePercentOfConsensus, s.expectedDirection, s.basePrice,
      s.releaseBar.rangePercent, s.releaseBar.volumeVsPriorHour,
      s.path.p1, s.path.p2, s.path.p5, s.path.p15, s.path.p30, s.path.p60,
      s.mfePercent, s.maePercent, s.mfeAtMinute, s.capturedByMinute1Percent,
      s.directionConflict ? 1 : 0, (s.simultaneousWith || []).length,
    ].join(','));
  }
  return lines.join('\n');
}

function loadAll() {
  if (!fs.existsSync(OUT_DIR)) return [];
  return fs.readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

if (require.main === module) {
  const mode = process.argv[2] || 'harvest';
  const arg = process.argv[3];
  if (mode === 'csv') {
    const studies = loadAll();
    if (!studies.length) { console.error('no event studies yet — run `npm run events:harvest` first'); process.exit(1); }
    const out = path.join(OUT_DIR, 'summary.csv');
    fs.writeFileSync(out, toCsv(studies));
    console.log(`wrote ${studies.length} events to ${out}`);
  } else if (mode === 'show') {
    const studies = loadAll().filter((s) => !arg || s.date === arg || s.name.toLowerCase().includes(String(arg).toLowerCase()));
    if (!studies.length) { console.error('no matching event'); process.exit(1); }
    for (const s of studies) {
      console.log(`\n=== ${s.date} ${s.name} (${s.symbol}) ===`);
      console.log(`released ${s.releaseUtc} | actual ${s.actual} vs consensus ${s.consensus} => expect ${s.expectedDirection}`);
      console.log(`release bar: range ${s.releaseBar.rangePercent}%, volume ${s.releaseBar.volumeVsPriorHour}x prior hour`);
      console.log('path (signed by expected direction, % from pre-release close):');
      console.log('  before:', OFFSETS_BEFORE.map((m) => `${m}m ${s.path[`m${m}`]}`).join('  '));
      console.log('  after :', OFFSETS_AFTER.map((m) => `+${m}m ${s.path[`p${m}`]}`).join('  '));
      console.log(`MFE ${s.mfePercent}% (at +${s.mfeAtMinute}m)  MAE ${s.maePercent}%  | ${s.capturedByMinute1Percent}% of the hour's move was gone by +1m`);
    }
  } else {
    const days = Number(arg) || 180;
    const symbol = process.argv[4] || 'BTC-USDT';
    run({ days, symbol }).then((studies) => {
      console.log(`\n${studies.length} event studies stored in data/event-studies/`);
      console.log('next: `npm run events:csv` for a spreadsheet, or `npm run events:show -- <date|name>`');
    }).catch((err) => { console.error(err); process.exit(1); });
  }
}

module.exports = { run, toCsv, loadAll, buildStudy };
