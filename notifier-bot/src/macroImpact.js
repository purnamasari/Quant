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

// Longest match wins, not first-in-array. Ordering used to decide this, which
// silently made specific entries unreachable: "Atlanta Fed GDPNow" is listed
// explicitly under growth data, but the Fed-policy entry appeared earlier and
// its loose "Fed " token swallowed it — so a nowcast was being explained as a
// rate decision. Scoring by match length makes the specific entry win wherever
// it sits in the file.
function findImpact(eventName) {
  const lower = eventName.toLowerCase();
  let best = null;
  let bestLen = 0;
  for (const entry of TABLE) {
    for (const m of entry.matches) {
      const token = m.toLowerCase();
      if (lower.includes(token) && token.length > bestLen) {
        best = entry;
        bestLen = token.length;
      }
    }
  }
  return best;
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

// The H-1 ping lists both branches ("if higher... if lower..."); this is the
// after-the-fact counterpart that says which one actually happened. Same
// table, so the follow-up is guaranteed consistent with what was promised
// beforehand rather than a second, independently-worded opinion.
//
// `direction` is 'higher' | 'lower' | 'inline'. Inline gets no branch text on
// purpose: when a release lands on consensus the textbook reaction is
// "already priced in", and printing the higher- or lower-than scenario there
// would assert a move the data does not support.
function formatOutcomeBlock(eventName, direction) {
  const impact = findImpact(eventName);
  if (!impact) return null;
  if (direction === 'inline') {
    return [
      `<b>Sesuai konsensus (${impact.label})</b> — biasanya reaksi paling kecil, karena sudah priced in.`,
      'Yang lebih menentukan justru revisi data sebelumnya dan detail di dalam rilisnya.',
      '',
      `⚠️ ${impact.caveat}`,
    ].join('\n');
  }
  const branch = direction === 'higher' ? impact.higher : impact.lower;
  const label = direction === 'higher' ? 'Lebih tinggi dari konsensus' : 'Lebih rendah dari konsensus';
  return [
    `<b>${label} (${impact.label})</b>`,
    `📈 Saham: ${branch.stocks}`,
    `🪙 Crypto: ${branch.crypto}`,
    '',
    `⚠️ ${impact.caveat}`,
  ].join('\n');
}

module.exports = { findImpact, formatImpactBlock, formatOutcomeBlock };
