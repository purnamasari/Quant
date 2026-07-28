// FOLLOW/SKIP inline buttons on each alert, for tracking which signals you
// actually acted on. IMPORTANT LIMITATION: this bot is a daily cron job,
// not a running server — there's no webhook/long-poll listener sitting
// there waiting for button taps in real time. Telegram queues callback
// updates server-side, so button presses aren't lost, but they're only
// processed (logged + the button's loading spinner cleared) the NEXT time
// job.js runs — i.e. up to ~24h delayed, not instant. If that's not good
// enough, it'd need a real persistent process (out of scope for what a
// scheduled Routine gives you here).

const fs = require('node:fs');
const path = require('node:path');
const { getUpdates, answerCallbackQuery } = require('./telegram');

const LOG_PATH = path.join(__dirname, '..', 'data', 'alert-log.json');
const OFFSET_PATH = path.join(__dirname, '..', 'data', '.telegram-update-offset.json');

function loadLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveLog(log) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

function loadOffset() {
  if (!fs.existsSync(OFFSET_PATH)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(OFFSET_PATH, 'utf8')).offset;
  } catch {
    return undefined;
  }
}

function saveOffset(offset) {
  fs.writeFileSync(OFFSET_PATH, JSON.stringify({ offset }));
}

function makeAlertId(market, symbol, kind) {
  return `${market}-${symbol}-${kind}-${new Date().toISOString().slice(0, 10)}`.replace(/[^a-zA-Z0-9-]/g, '');
}

function keyboardFor(alertId) {
  return {
    inline_keyboard: [[
      { text: '✅ FOLLOW', callback_data: `follow:${alertId}` },
      { text: '❌ SKIP', callback_data: `skip:${alertId}` },
    ]],
  };
}

function recordAlert({ id, market, symbol, kind, direction, conviction }) {
  const log = loadLog();
  log.push({ id, market, symbol, kind, direction, conviction, sentAt: new Date().toISOString(), decision: null, decidedAt: null });
  // keep the log from growing forever — 90 days is plenty for reviewing your own follow-through
  const cutoff = Date.now() - 90 * 86_400_000;
  const trimmed = log.filter((e) => new Date(e.sentAt).getTime() >= cutoff);
  saveLog(trimmed);
}

// Call once at the start of each job run to catch up on button presses
// made since the last run.
async function processPendingCallbacks() {
  const offset = loadOffset();
  const updates = await getUpdates(offset);
  if (!updates.length) return { processed: 0 };

  const log = loadLog();
  let processed = 0;
  let maxUpdateId = offset ? offset - 1 : 0;

  for (const update of updates) {
    maxUpdateId = Math.max(maxUpdateId, update.update_id);
    const cq = update.callback_query;
    if (!cq?.data) continue;
    const [action, id] = cq.data.split(':');
    if (action !== 'follow' && action !== 'skip') continue;

    const entry = log.find((e) => e.id === id);
    if (entry && !entry.decision) {
      entry.decision = action;
      entry.decidedAt = new Date().toISOString();
      processed += 1;
    }
    await answerCallbackQuery(cq.id, action === 'follow' ? 'Tercatat: FOLLOW' : 'Tercatat: SKIP');
  }

  saveLog(log);
  saveOffset(maxUpdateId + 1);
  return { processed };
}

module.exports = { makeAlertId, keyboardFor, recordAlert, processPendingCallbacks, LOG_PATH };
