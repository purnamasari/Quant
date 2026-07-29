// Static reference table (data/macro-event-impact.json) of "if the number
// comes in higher/lower than consensus, here's the textbook stock/crypto
// reaction" per macro event category. This is a simplified heuristic, not
// a guarantee — see each entry's `caveat` and the blanket one below. Real
// market reaction depends on what's already priced in and which narrative
// is dominant (inflation-scare vs growth-scare), which no static table can
// capture.

const fs = require('node:fs');
const path = require('node:path');

const TABLE = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'macro-event-impact.json'), 'utf8'),
);

function findImpact(eventName) {
  const lower = eventName.toLowerCase();
  return TABLE.find((entry) => entry.matches.some((m) => lower.includes(m.toLowerCase()))) || null;
}

function formatImpactBlock(eventName) {
  const impact = findImpact(eventName);
  if (!impact) return null;
  return [
    `<b>Kalau lebih tinggi dari konsensus (${impact.label}):</b>`,
    `📈 Saham: ${impact.higher.stocks}`,
    `🪙 Crypto: ${impact.higher.crypto}`,
    '',
    `<b>Kalau lebih rendah dari konsensus:</b>`,
    `📈 Saham: ${impact.lower.stocks}`,
    `🪙 Crypto: ${impact.lower.crypto}`,
    '',
    `⚠️ ${impact.caveat}`,
  ].join('\n');
}

module.exports = { findImpact, formatImpactBlock };
