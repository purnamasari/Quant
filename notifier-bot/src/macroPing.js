// Runs hourly (see a separate Routine from the daily job.js) to catch
// macro events about an hour before they happen — the daily H-1 reminder
// in job.js only tells you what's happening tomorrow, not a same-hour
// nudge. State file avoids double-pinging the same event across runs.

const fs = require('node:fs');
const path = require('node:path');
const { sendMessage } = require('./telegram');
const { getMacroEventsForDate, parseValue } = require('./macro');
const { withWib } = require('./time');
const { formatImpactBlock, formatOutcomeBlock } = require('./macroImpact');

const STATE_PATH = path.join(__dirname, '..', 'data', '.macro-ping-state.json');
const PING_WINDOW_MINUTES = 70; // must be >= the polling interval (hourly) so no event is missed between checks
// How long after a release we still bother announcing the result. Wide enough
// that an hourly job never misses one, short enough that a figure released
// this morning isn't announced as news at 10pm.
const RESULT_WINDOW_MINUTES = 240;
// Consensus figures are quoted to the same precision as the release, so an
// exact match means "in line". Anything else is a genuine beat or miss.
const INLINE_EPSILON = 1e-9;

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
  // Drop stale entries from previous days so the file doesn't grow forever.
  // Keys come in two shapes — "<date>|<time>|<name>" for the H-1 ping and
  // "result|<date>|<time>|<name>" for the outcome — so the date is matched
  // anywhere in the key rather than only as a prefix. A prefix-only test
  // silently deleted every result key on each run, which defeated the dedup
  // and re-announced the same release every hour.
  for (const key of Object.keys(state)) {
    if (!key.includes(date)) delete state[key];
  }

  const now = new Date();
  let sent = 0;
  let results = 0;
  for (const event of events) {
    const key = `${date}|${event.time}|${event.name}`;
    const eventTime = eventDateTime(date, event.time);
    if (!eventTime) continue;
    const minutesUntil = (eventTime.getTime() - now.getTime()) / 60000;

    if (!state[key] && minutesUntil > 0 && minutesUntil <= PING_WINDOW_MINUTES) {
      const impactBlock = formatImpactBlock(event.name);
      const lines = [
        `⏰ <b>~1 jam lagi:</b> ${event.name}`,
        `${withWib(event.time)}${event.consensus ? ` (consensus ${event.consensus})` : ''}`,
      ];
      if (impactBlock) lines.push('', impactBlock);
      await sendMessage(lines.join('\n'));
      state[key] = true;
      sent += 1;
      continue; // the result can't be out yet — nothing more to do for this event
    }

    // Result announcement: closes the loop the H-1 ping opens. That ping lists
    // both branches; this says which one actually happened. Gated on `actual`
    // being populated rather than on the clock, since releases can be late and
    // an empty figure would otherwise be announced as news.
    const resultKey = `result|${key}`;
    if (state[resultKey]) continue;
    const minutesSince = -minutesUntil;
    if (minutesSince <= 0 || minutesSince > RESULT_WINDOW_MINUTES) continue;
    if (!event.actual) continue; // not released yet, or Nasdaq hasn't filled it in

    const actualNum = parseValue(event.actual);
    const consensusNum = parseValue(event.consensus);
    let direction = null;
    if (actualNum !== null && consensusNum !== null) {
      if (Math.abs(actualNum - consensusNum) < INLINE_EPSILON) direction = 'inline';
      else direction = actualNum > consensusNum ? 'higher' : 'lower';
    }

    const emoji = direction === 'higher' ? '🔺' : direction === 'lower' ? '🔻' : '➖';
    const lines = [
      `${emoji} <b>Hasil rilis:</b> ${event.name}`,
      `Aktual <b>${event.actual}</b>` +
        (event.consensus ? ` vs konsensus ${event.consensus}` : '') +
        (event.previous ? ` (sebelumnya ${event.previous})` : ''),
    ];
    // No consensus published means there is no beat/miss to reason about —
    // report the number and stop rather than invent a direction.
    const outcomeBlock = direction ? formatOutcomeBlock(event.name, direction) : null;
    if (outcomeBlock) lines.push('', outcomeBlock);
    else if (!direction) lines.push('', '<i>Tidak ada konsensus untuk dibandingkan — angkanya saja.</i>');

    await sendMessage(lines.join('\n'));
    state[resultKey] = true;
    results += 1;
  }
  saveState(state);
  return { sent, results };
}

if (require.main === module) {
  runMacroPing()
    .then(({ sent, results }) => console.log(`[macroPing] ${sent} reminder(s) + ${results} result(s) sent`))
    .catch((err) => {
      console.error('[macroPing] fatal:', err);
      process.exit(1);
    });
}

module.exports = { runMacroPing };
