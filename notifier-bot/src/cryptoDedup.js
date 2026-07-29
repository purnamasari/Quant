// Since cryptoJob.js runs every 15 minutes, the same signal would
// otherwise re-fire on every single check throughout the day. This tracks
// what's already been alerted per (date, symbol, kind, status) so each
// distinct thing only gets sent once: at most one "provisional" ping
// (candle still forming) and one "confirmed" ping (candle closed) per
// symbol+kind+day.

const fs = require('node:fs');
const path = require('node:path');

const STATE_PATH = path.join(__dirname, '..', 'data', '.crypto-alert-dedup.json');

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// Returns true (and marks it sent) the first time this exact
// symbol+kind+status is seen today; false on every repeat.
function shouldSend(symbol, kind, status) {
  const date = todayKey();
  const state = loadState();
  for (const key of Object.keys(state)) {
    if (!key.startsWith(date)) delete state[key];
  }
  const key = `${date}|${symbol}|${kind}|${status}`;
  if (state[key]) {
    saveState(state);
    return false;
  }
  state[key] = true;
  saveState(state);
  return true;
}

module.exports = { shouldSend };
