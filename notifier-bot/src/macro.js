// H-1 macro event reminder via Nasdaq's public economic-calendar API (no
// auth needed — tested reachable from this environment; Binance/Bybit were
// not, see crypto/okx.js). Filters to major US releases that tend to move
// markets broadly (not every single regional housing sub-index etc).

const fs = require('node:fs');
const path = require('node:path');

const MAJOR_KEYWORDS = [
  'CPI', 'PCE', 'Nonfarm', 'Non-Farm', 'Payroll', 'FOMC', 'Fed ', 'Interest Rate',
  'Rate Decision', 'GDP', 'Unemployment Rate', 'ISM', 'Retail Sales', 'PPI',
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
function parseValue(raw) {
  const text = cleanValue(raw);
  if (text === null) return null;
  const match = text.match(/-?\d+(?:\.\d+)?/);
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

async function fetchCalendarRows(dateYmd) {
  const url = `https://api.nasdaq.com/api/calendar/economicevents?date=${dateYmd}`;
  for (let attempt = 1; attempt <= CALENDAR_ATTEMPTS; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.rows) return json.data.rows;
      // data:null — throttled or truly empty; we cannot tell them apart, so retry.
    }
    if (attempt < CALENDAR_ATTEMPTS) await new Promise((r) => setTimeout(r, 1200 * attempt));
  }
  console.warn(`[macro] calendar unavailable for ${dateYmd} after ${CALENDAR_ATTEMPTS} attempts ` +
    '(Nasdaq returned no rows) — falling back to the local FOMC calendar only');
  return null;
}

async function getMacroEventsForDate(dateYmd) {
  try {
    const rows = await fetchCalendarRows(dateYmd);
    // null means the feed never answered; an FOMC date is still known locally.
    if (rows === null) return fomcEventsForDate(dateYmd);
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
    return withFomcCorrection(mapped, dateYmd);
  } catch (err) {
    console.error('[macro] fetch failed:', err.message);
    // Even with the feed down, a known FOMC date should still be announced.
    return fomcEventsForDate(dateYmd);
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

function fomcEventsForDate(dateYmd) {
  const entry = (FOMC.decisions || []).find((d) => d.date === dateYmd);
  if (!entry) return [];
  const sep = entry.sep ? ' + Summary of Economic Projections (dot plot)' : '';
  return [
    { time: FOMC_DECISION_ET, name: `FOMC Statement / Fed Interest Rate Decision${sep}`, consensus: null, previous: null, actual: null, fromFedCalendar: true },
    { time: FOMC_PRESSER_ET, name: 'FOMC Press Conference', consensus: null, previous: null, actual: null, fromFedCalendar: true },
  ];
}

// Merge the Fed's authoritative FOMC entries in, and drop any FOMC rows the
// aggregator reports on a date the Fed does not list — those are the wrong-day
// duplicates. Nasdaq's own rows survive when the dates agree, since they carry
// consensus and actual figures this static file cannot.
function withFomcCorrection(events, dateYmd) {
  const isFomcRow = (name) => /fomc|fed interest rate|rate decision/i.test(name);
  const fedEvents = fomcEventsForDate(dateYmd);
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

module.exports = { getMacroEventsForDate, getTomorrowMacroEvents, tomorrowYmd, parseValue, cleanValue };
