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
      .map((r) => ({ time: r.gmt, name: r.eventName, consensus: r.consensus, previous: r.previous }));
  } catch (err) {
    console.error('[macro] fetch failed:', err.message);
    return [];
  }
}

async function getTomorrowMacroEvents() {
  return getMacroEventsForDate(tomorrowYmd());
}

module.exports = { getMacroEventsForDate, getTomorrowMacroEvents, tomorrowYmd };
