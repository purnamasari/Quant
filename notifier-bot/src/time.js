// WIB = UTC+7 (Waktu Indonesia Barat), no DST, so this is a fixed offset.

function utcHhmmToWib(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const totalMinutes = (h * 60 + m + 7 * 60) % (24 * 60);
  const wh = Math.floor(totalMinutes / 60);
  const wm = totalMinutes % 60;
  return `${String(wh).padStart(2, '0')}:${String(wm).padStart(2, '0')}`;
}

function withWib(utcHhmm) {
  return `${utcHhmm} UTC (${utcHhmmToWib(utcHhmm)} WIB)`;
}

function nowStampWithWib(date = new Date()) {
  const utc = date.toISOString().slice(0, 16).replace('T', ' ');
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ');
  return `${utc} UTC / ${wib} WIB`;
}

// Nasdaq's economic-calendar field is NAMED `gmt` but carries US Eastern
// times. Proven by the release conventions, which line up exactly and only
// under ET: FOMC statements are always 14:00 ET (never 14:00 GMT), ADP is
// 08:15 ET, Goods Trade Balance 08:30 ET, EIA crude 10:30 ET, MBA 07:00 ET.
// Treating those as UTC shifted every macro time 4-5 hours and made the H-1
// ping fire hours early — the same ping would then be marked sent, so nothing
// arrived at the real hour.
//
// Eastern switches between EDT (UTC-4) and EST (UTC-5), so the offset is
// resolved per-date through the IANA zone rather than hard-coded.
const ET_ZONE = 'America/New_York';

function pad2(n) {
  return String(n).padStart(2, '0');
}

// The UTC instant whose New York wall clock reads dateYmd hh:mm. Works by
// asking what a naive-UTC guess looks like in New York and correcting by the
// difference — which yields the zone's offset for that specific date, DST
// included.
function etToUtc(dateYmd, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const guess = new Date(`${dateYmd}T${pad2(h)}:${pad2(m)}:00Z`);
  if (Number.isNaN(guess.getTime())) return null;
  const asEt = new Date(guess.toLocaleString('en-US', { timeZone: ET_ZONE }));
  const asUtc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(guess.getTime() + (asUtc.getTime() - asEt.getTime()));
}

// Display helper for a Nasdaq-style ET time: shows ET, the real UTC, and WIB.
// A release late in the ET day lands on the next WIB date, which is called out
// explicitly so an evening ET event isn't read as the same morning in Jakarta.
function withEtAndWib(etHhmm, dateYmd) {
  const utc = etToUtc(dateYmd, etHhmm);
  if (!utc) return etHhmm;
  const utcHhmm = `${pad2(utc.getUTCHours())}:${pad2(utc.getUTCMinutes())}`;
  const wibDate = new Date(utc.getTime() + 7 * 60 * 60 * 1000);
  const wibHhmm = `${pad2(wibDate.getUTCHours())}:${pad2(wibDate.getUTCMinutes())}`;
  const nextDay = wibDate.toISOString().slice(0, 10) !== utc.toISOString().slice(0, 10)
    || wibDate.toISOString().slice(0, 10) !== dateYmd;
  return `${etHhmm} ET / ${utcHhmm} UTC (${wibHhmm} WIB${nextDay ? ', besok' : ''})`;
}

module.exports = { utcHhmmToWib, withWib, nowStampWithWib, etToUtc, withEtAndWib, ET_ZONE };
