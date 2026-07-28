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

module.exports = { utcHhmmToWib, withWib, nowStampWithWib };
