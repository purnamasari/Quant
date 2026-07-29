// H-1 macro event reminder via Nasdaq's public economic-calendar API (no
// auth needed — tested reachable from this environment; Binance/Bybit were
// not, see crypto/okx.js). Filters to major US releases that tend to move
// markets broadly (not every single regional housing sub-index etc).

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

async function getMacroEventsForDate(dateYmd) {
  const url = `https://api.nasdaq.com/api/calendar/economicevents?date=${dateYmd}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const json = await res.json();
    const rows = json?.data?.rows || [];
    return rows
      .filter((r) => r.country === 'United States' && isMajor(r.eventName))
      .map((r) => ({
        time: r.gmt,
        name: r.eventName,
        consensus: cleanValue(r.consensus),
        previous: cleanValue(r.previous),
        // Populated only once the release is out; blank/&nbsp; before then.
        actual: cleanValue(r.actual),
      }));
  } catch (err) {
    console.error('[macro] fetch failed:', err.message);
    return [];
  }
}

async function getTomorrowMacroEvents() {
  return getMacroEventsForDate(tomorrowYmd());
}

module.exports = { getMacroEventsForDate, getTomorrowMacroEvents, tomorrowYmd, parseValue, cleanValue };
