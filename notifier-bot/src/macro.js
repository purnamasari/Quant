// H-1 macro event reminder via Nasdaq's public economic-calendar API (no
// auth needed — tested reachable from this environment; Binance/Bybit were
// not, see crypto/okx.js). Filters to major US releases that tend to move
// markets broadly (not every single regional housing sub-index etc).

const fs = require('node:fs');
const path = require('node:path');

// Deliberately does NOT include a bare 'Fed ' token. That matched every
// regional Fed survey — Dallas Fed Services Revenues, Richmond, Philly — which
// are not broad market movers, and worse, they then inherited the FOMC impact
// text and were announced as if they were rate decisions. Policy events are
// matched by their actual names instead.
const MAJOR_KEYWORDS = [
  'CPI', 'PCE', 'Nonfarm', 'Non-Farm', 'Payroll', 'FOMC', 'Fed Interest Rate',
  'Interest Rate Decision', 'Rate Decision', 'Federal Funds',
  'GDP', 'Unemployment Rate', 'ISM', 'Retail Sales', 'PPI',
  'Jobless Claims', 'Consumer Confidence', 'PMI',
];

function isMajor(eventName) {
  return MAJOR_KEYWORDS.some((k) => eventName.toLowerCase().includes(k.toLowerCase()));
}

// Nasdaq uses "&nbsp;" and bare spaces for "no value", which would otherwise
// read as a present-but-empty figure downstream.
function cleanValue(raw) {
  const text = String(raw ?? '').replace(/&nbsp;/gi, '').trim();
  return text || null;
}

// Values arrive as display strings: "0.3%", "-101.50B", "15.00K", "3.2".
// Suffixes are scale markers, not part of the number, and every value for a
// given event shares the same unit — so comparing actual against consensus
// only needs the numeric part, with the suffix left for display.
// Thousands separators must be stripped BEFORE the number is matched. Without
// it the regex stops at the first comma, so "1,782K" parsed as 1 and "1,800K"
// also parsed as 1 — they compared equal and a clear miss on Continuing Jobless
// Claims was announced as "in line with consensus". Every release quoted with
// separators (claims, payrolls) was affected, and it fails silently: the
// message looks perfectly well-formed while asserting the wrong direction.
//
// Safe for this feed specifically: Nasdaq's US calendar uses comma for
// thousands and period for decimals. A source using comma as the decimal mark
// would need different handling.
function parseValue(raw) {
  const text = cleanValue(raw);
  if (text === null) return null;
  const match = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function tomorrowYmd() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// Nasdaq answers a throttled request with HTTP 200 and `data: null`
// ("Economic Events Calendar: No record found.", code 1002) — indistinguishable
// from a genuinely empty day unless the null is checked for specifically.
// Silently reporting "no macro events" when the feed simply refused is the
// same silent-failure shape fixed in cryptoJob, so retry first and say so
// loudly if it persists.
const CALENDAR_ATTEMPTS = 3;

// Nasdaq's answer for a given date is not stable. 2026-07-30 returned
// `data: null` all morning while 07-29 and 07-31 answered normally, and the
// day's real slate (GDP, Core PCE, jobless claims) only appeared hours later.
// The H-1 ping therefore never fired for any of it: at ping time the calendar
// genuinely looked empty.
//
// So every good fetch is written to data/macro-cache/, and a fetch that comes
// back empty falls back to the last known copy for that date rather than
// concluding nothing is scheduled. A stale copy is a far better basis for a
// warning than silence — the times and consensus figures are set days ahead,
// and only `actual` needs the live feed.
const CACHE_DIR = path.join(__dirname, '..', 'data', 'macro-cache');

function cacheFile(dateYmd) {
  return path.join(CACHE_DIR, `${dateYmd}.json`);
}

function readCachedRows(dateYmd) {
  try {
    const rows = JSON.parse(fs.readFileSync(cacheFile(dateYmd), 'utf8'));
    return Array.isArray(rows) && rows.length ? rows : null;
  } catch {
    return null;
  }
}

// How much a snapshot is worth keeping. Needed because the feed does not just
// go empty — on 2026-07-30 it served THREE different days for the same date
// within six hours: `data: null` in the morning, the correct Thursday slate
// (GDP, Core PCE, jobless claims) around 14:00 UTC, then Wednesday's content
// (mortgage applications, crude inventories, the 28-29 FOMC rows) at 16:00.
//
// A cache that overwrites on every successful fetch therefore destroys the good
// copy as soon as the feed wobbles — which is exactly what happened the first
// time this ran. Score by the major US rows a snapshot carries, weighting rows
// whose `actual` is filled in, and refuse any write that scores lower than what
// is already stored. A later fetch of the same date can add figures; it cannot
// take the day's slate away.
function snapshotScore(rows) {
  let score = 0;
  for (const r of rows) {
    if (r.country !== 'United States' || !isMajor(r.eventName || '')) continue;
    score += 1;
    if (cleanValue(r.actual) !== null) score += 2;
  }
  return score;
}

function writeCachedRows(dateYmd, rows) {
  try {
    const incoming = snapshotScore(rows);
    const existing = readCachedRows(dateYmd);
    if (existing) {
      const current = snapshotScore(existing);
      if (incoming < current) {
        console.warn(`[macro] keeping cached ${dateYmd} (score ${current}) — ` +
          `live copy scored only ${incoming}, which means the feed is serving a thinner ` +
          'or different day for this date');
        return;
      }
    }
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cacheFile(dateYmd), JSON.stringify(rows));
  } catch (err) {
    console.warn(`[macro] could not cache ${dateYmd}: ${err.message}`);
  }
}

async function fetchCalendarRows(dateYmd) {
  const url = `https://api.nasdaq.com/api/calendar/economicevents?date=${dateYmd}`;
  for (let attempt = 1; attempt <= CALENDAR_ATTEMPTS; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.rows) {
        writeCachedRows(dateYmd, json.data.rows);
        // The live answer is not automatically the best answer. When the feed
        // serves a thinner or different day for this date, the richer cached
        // snapshot is what the alerts should run on — otherwise a mid-day
        // wobble silently erases the day's real slate from every downstream
        // consumer, not just from the cache file.
        const cachedNow = readCachedRows(dateYmd);
        if (cachedNow && snapshotScore(cachedNow) > snapshotScore(json.data.rows)) {
          console.warn(`[macro] live copy for ${dateYmd} is thinner than the cached one — using cache`);
          return cachedNow;
        }
        return json.data.rows;
      }
      // data:null — throttled, or a transient hole like 2026-07-30. Either way
      // it is not evidence that the day is empty; retry, then fall back.
    }
    if (attempt < CALENDAR_ATTEMPTS) await new Promise((r) => setTimeout(r, 1200 * attempt));
  }

  const cached = readCachedRows(dateYmd);
  if (cached) {
    console.warn(`[macro] live calendar empty for ${dateYmd} after ${CALENDAR_ATTEMPTS} attempts ` +
      `— using ${cached.length} cached row(s). Scheduled times and consensus are reliable; ` +
      "'actual' may lag until the feed recovers.");
    return cached;
  }

  console.warn(`[macro] calendar unavailable for ${dateYmd} after ${CALENDAR_ATTEMPTS} attempts ` +
    'and no cached copy exists — falling back to the local FOMC calendar only');
  return null;
}

async function getMacroEventsForDate(dateYmd) {
  try {
    const rows = await fetchCalendarRows(dateYmd);
    // null means the feed never answered; an FOMC date is still known locally.
    if (rows === null) return await fomcEventsForDate(dateYmd);
    const mapped = rows
      .filter((r) => r.country === 'United States' && isMajor(r.eventName))
      .map((r) => ({
        time: r.gmt,
        name: r.eventName,
        consensus: cleanValue(r.consensus),
        previous: cleanValue(r.previous),
        // Populated only once the release is out; blank/&nbsp; before then.
        actual: cleanValue(r.actual),
      }));
    return await withFomcCorrection(mapped, dateYmd);
  } catch (err) {
    console.error('[macro] fetch failed:', err.message);
    // Even with the feed down, a known FOMC date should still be announced.
    return await fomcEventsForDate(dateYmd);
  }
}

// FOMC decisions come from the Fed's own calendar, not the aggregator.
// Nasdaq placed the July 2026 decision on the 30th when the Fed schedules that
// meeting for July 28-29 — a one-day error on the highest-impact event there
// is. See data/fomc-dates.json for the reasoning and the maintenance note.
const FOMC = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'fomc-dates.json'), 'utf8'),
);
const FOMC_DECISION_ET = '14:00';
const FOMC_PRESSER_ET = '14:30';

// The Fed calendar gives the right DATE; Nasdaq has the consensus and,
// eventually, the actual rate — but on its own (wrong) date. Fetching that row
// and merging it in gives the ping a consensus to show and lets the result
// announcement fire at all. Without this the FOMC entry carried nulls forever,
// so the H-1 ping went out with no consensus and the outcome could never be
// announced, since that path requires `actual` to be populated.
async function fomcFiguresNear(dateYmd) {
  const day = new Date(`${dateYmd}T00:00:00Z`);
  for (const offset of [0, 1, -1, 2]) {
    const probe = new Date(day.getTime() + offset * 86400000).toISOString().slice(0, 10);
    let rows;
    try {
      rows = await fetchCalendarRows(probe);
    } catch {
      continue;
    }
    if (!rows) continue;
    const match = rows.find((r) => r.country === 'United States'
      && /fed interest rate|interest rate decision|rate decision/i.test(r.eventName));
    if (match) {
      const actual = cleanValue(match.actual);
      const consensus = cleanValue(match.consensus);
      if (actual || consensus) return { actual, consensus, previous: cleanValue(match.previous), source: probe };
    }
  }
  return { actual: null, consensus: null, previous: null, source: null };
}

async function fomcEventsForDate(dateYmd) {
  const entry = (FOMC.decisions || []).find((d) => d.date === dateYmd);
  if (!entry) return [];
  const sep = entry.sep ? ' + Summary of Economic Projections (dot plot)' : '';
  const figures = await fomcFiguresNear(dateYmd);
  return [
    {
      time: FOMC_DECISION_ET,
      name: `FOMC Statement / Fed Interest Rate Decision${sep}`,
      consensus: figures.consensus,
      previous: figures.previous,
      actual: figures.actual,
      fromFedCalendar: true,
    },
    // The press conference has no number of its own — it is commentary, so it
    // gets a ping but can never produce a result announcement.
    { time: FOMC_PRESSER_ET, name: 'FOMC Press Conference', consensus: null, previous: null, actual: null, fromFedCalendar: true },
  ];
}

// Merge the Fed's authoritative FOMC entries in, and drop any FOMC rows the
// aggregator reports on a date the Fed does not list — those are the wrong-day
// duplicates. Nasdaq's own rows survive when the dates agree, since they carry
// consensus and actual figures this static file cannot.
async function withFomcCorrection(events, dateYmd) {
  const isFomcRow = (name) => /fomc|fed interest rate|rate decision/i.test(name);
  const fedEvents = await fomcEventsForDate(dateYmd);
  const fedListsThisDate = fedEvents.length > 0;
  const knownYear = (FOMC.decisions || []).some((d) => d.date.slice(0, 4) === dateYmd.slice(0, 4));

  // Unknown year: no basis to correct anything, so leave the feed untouched.
  if (!knownYear) return events;

  const kept = events.filter((e) => !isFomcRow(e.name) || fedListsThisDate);
  if (!fedListsThisDate) return kept;
  // Fed says this IS a decision date. Keep Nasdaq's rows if it agrees (they
  // have the numbers), otherwise supply our own so the event is never missed.
  const hasNasdaqFomc = kept.some((e) => isFomcRow(e.name));
  return hasNasdaqFomc ? kept : [...kept, ...fedEvents];
}

async function getTomorrowMacroEvents() {
  return getMacroEventsForDate(tomorrowYmd());
}

// snapshotScore and writeCachedRows are exported for testing: the cache
// downgrade guard is the part most likely to be broken by a future edit, and
// it fails silently (a poisoned cache looks exactly like a quiet day).
module.exports = {
  getMacroEventsForDate, getTomorrowMacroEvents, tomorrowYmd, parseValue, cleanValue,
  snapshotScore, writeCachedRows, readCachedRows,
};
