// Runs hourly (see a separate Routine from the daily job.js) to catch
// macro events about an hour before they happen — the daily H-1 reminder
// in job.js only tells you what's happening tomorrow, not a same-hour
// nudge. State file avoids double-pinging the same event across runs.

const fs = require('node:fs');
const path = require('node:path');
const { sendMessage } = require('./telegram');
const { getMacroEventsForDate } = require('./macro');
const { withWib } = require('./time');

const STATE_PATH = path.join(__dirname, '..', 'data', '.macro-ping-state.json');
const PING_WINDOW_MINUTES = 70; // must be >= the polling interval (hourly) so no event is missed between checks

function todayYmd() {
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

function eventDateTime(dateYmd, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return new Date(`${dateYmd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
}

async function runMacroPing() {
  const date = todayYmd();
  const events = await getMacroEventsForDate(date);
  const state = loadState();
  // drop stale entries from previous days so the file doesn't grow forever
  for (const key of Object.keys(state)) {
    if (!key.startsWith(date)) delete state[key];
  }

  const now = new Date();
  let sent = 0;
  for (const event of events) {
    const key = `${date}|${event.time}|${event.name}`;
    if (state[key]) continue;
    const eventTime = eventDateTime(date, event.time);
    if (!eventTime) continue;
    const minutesUntil = (eventTime.getTime() - now.getTime()) / 60000;
    if (minutesUntil > 0 && minutesUntil <= PING_WINDOW_MINUTES) {
      await sendMessage(
        `⏰ <b>~1 jam lagi:</b> ${event.name}\n${withWib(event.time)}${event.consensus && event.consensus.trim() ? ` (consensus ${event.consensus})` : ''}`,
      );
      state[key] = true;
      sent += 1;
    }
  }
  saveState(state);
  return sent;
}

if (require.main === module) {
  runMacroPing()
    .then((sent) => console.log(`[macroPing] ${sent} reminder(s) sent`))
    .catch((err) => {
      console.error('[macroPing] fatal:', err);
      process.exit(1);
    });
}

module.exports = { runMacroPing };
