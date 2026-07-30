// Runs hourly (see a separate Routine from the daily job.js) to catch
// macro events about an hour before they happen — the daily H-1 reminder
// in job.js only tells you what's happening tomorrow, not a same-hour
// nudge. State file avoids double-pinging the same event across runs.

const fs = require('node:fs');
const path = require('node:path');
const { sendMessage } = require('./telegram');
const { getMacroEventsForDate, parseValue } = require('./macro');
const { etToUtc, withEtAndWib } = require('./time');
const { formatImpactBlock, formatOutcomeBlock, findImpact } = require('./macroImpact');

const STATE_PATH = path.join(__dirname, '..', 'data', '.macro-ping-state.json');
const PING_WINDOW_MINUTES = 70; // must be >= the polling interval (hourly) so no event is missed between checks
// How long after a release we still bother announcing the result. Wide enough
// that an hourly job never misses one, short enough that a figure released
// this morning isn't announced as news at 10pm.
const RESULT_WINDOW_MINUTES = 240;
// Wait this long past the scheduled time before announcing, so a figure is
// never reported at the exact moment it is due (releases can run a little
// late, and Nasdaq needs a moment to fill the row in).
const RESULT_SETTLE_MINUTES = 5;
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

// Nasdaq's `gmt` field actually carries Eastern time — see src/time.js for
// the evidence. Converting through the IANA zone keeps DST correct.
function eventDateTime(dateYmd, hhmm) {
  return etToUtc(dateYmd, hhmm);
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

  // Nasdaq splits one real-world moment across several rows — an FOMC decision
  // arrives as "FOMC Statement" AND "Fed Interest Rate Decision" at the same
  // minute, and repeated rows of the same indicator are common. Pinging each
  // separately would send the identical impact text several times in a row.
  // Group upcoming events by time + impact category so one moment is one
  // message, listing every name it covers.
  const pingGroups = new Map();
  for (const event of events) {
    const eventTime = eventDateTime(date, event.time);
    if (!eventTime) continue;
    const minutesUntil = (eventTime.getTime() - now.getTime()) / 60000;
    if (!(minutesUntil > 0 && minutesUntil <= PING_WINDOW_MINUTES)) continue;
    const impact = findImpact(event.name);
    // No impact entry means no shared category to group on — key by name so
    // unrelated events never get merged.
    const groupKey = `${date}|${event.time}|${impact ? impact.label : event.name}`;
    if (!pingGroups.has(groupKey)) pingGroups.set(groupKey, { time: event.time, impact, events: [] });
    pingGroups.get(groupKey).events.push(event);
  }

  for (const [groupKey, group] of pingGroups) {
    if (state[groupKey]) continue;
    const names = [...new Set(group.events.map((e) => e.name))];
    const withConsensus = group.events.find((e) => e.consensus);
    const impactBlock = formatImpactBlock(names[0]);
    const lines = [
      `⏰ <b>~1 jam lagi:</b> ${names[0]}`,
      `${withEtAndWib(group.time, date)}${withConsensus ? ` (consensus ${withConsensus.consensus})` : ''}`,
    ];
    if (names.length > 1) lines.push(`<i>Termasuk: ${names.slice(1).join(', ')}</i>`);
    if (impactBlock) lines.push('', impactBlock);
    await sendMessage(lines.join('\n'));
    state[groupKey] = true;
    sent += 1;
  }

  // Results are pooled exactly like the H-1 pings above, and for the same
  // reason. Nasdaq reports one release as many rows: 2026-07-30 sent ELEVEN
  // separate messages for what was really three releases — five PCE rows
  // ("Core PCE Price Index" appearing twice with different m/m and y/y
  // figures, plus "PCE price index" and "PCE Price index" differing only in
  // capitalisation), three GDP rows and three jobless-claims rows.
  //
  // Grouping on the impact category collapses those to one message per
  // release, which also fixes the casing bug for free: both PCE spellings
  // resolve to the same category, so they can no longer occupy separate dedup
  // keys. Sorting by time keeps the pooled batch in release order.
  const resultGroups = new Map();
  for (const event of events) {
    const eventTime = eventDateTime(date, event.time);
    if (!eventTime) continue;
    const minutesSince = (now.getTime() - eventTime.getTime()) / 60000;

    // Nasdaq populates `actual` BEFORE the release moment for some rows — CB
    // Consumer Confidence carried 90.8 two and a half hours ahead of its
    // 10:00 ET slot, with `previous` at 92.2, so it was not merely echoing the
    // prior print. Trusting that field alone announced an unreleased figure as
    // a result. The clock is therefore the authority, and a settle delay is
    // added on top so a figure is never announced the instant it is due.
    if (minutesSince < RESULT_SETTLE_MINUTES || minutesSince > RESULT_WINDOW_MINUTES) continue;
    if (!event.actual) continue; // not released yet, or Nasdaq hasn't filled it in

    const impact = findImpact(event.name);
    const groupKey = `result|${date}|${event.time}|${impact ? impact.label : event.name.toLowerCase()}`;
    if (!resultGroups.has(groupKey)) {
      resultGroups.set(groupKey, { time: event.time, impact, events: [], eventTime });
    }
    resultGroups.get(groupKey).events.push(event);
  }

  for (const [groupKey, group] of [...resultGroups].sort((a, b) => a[1].eventTime - b[1].eventTime)) {
    if (state[groupKey]) continue;

    // Direction is decided by the headline figure — the first row that has both
    // an actual and a consensus. The others are printed as supporting lines
    // rather than each asserting their own market reaction, because one release
    // cannot imply three different things at once.
    const scored = group.events.map((event) => {
      const actualNum = parseValue(event.actual);
      const consensusNum = parseValue(event.consensus);
      let direction = null;
      if (actualNum !== null && consensusNum !== null) {
        direction = Math.abs(actualNum - consensusNum) < INLINE_EPSILON
          ? 'inline'
          : (actualNum > consensusNum ? 'higher' : 'lower');
      }
      return { event, direction };
    });
    const headline = scored.find((s) => s.direction) || scored[0];
    const direction = headline.direction;

    const emoji = direction === 'higher' ? '🔺' : direction === 'lower' ? '🔻' : '➖';
    const title = group.impact ? group.impact.label : headline.event.name;
    const lines = [
      `${emoji} <b>Hasil rilis:</b> ${title} — ${withEtAndWib(group.time, date)}`,
    ];
    for (const { event, direction: d } of scored) {
      const mark = d === 'higher' ? '🔺' : d === 'lower' ? '🔻' : d === 'inline' ? '➖' : '·';
      lines.push(
        `${mark} ${event.name}: <b>${event.actual}</b>` +
        (event.consensus ? ` vs kons. ${event.consensus}` : '') +
        (event.previous ? ` (seb. ${event.previous})` : ''),
      );
    }

    // No consensus anywhere in the group means there is no beat/miss to reason
    // about — report the numbers and stop rather than invent a direction.
    const outcomeBlock = direction ? formatOutcomeBlock(headline.event.name, direction) : null;
    if (outcomeBlock) lines.push('', outcomeBlock);
    else lines.push('', '<i>Tidak ada konsensus untuk dibandingkan — angkanya saja.</i>');

    await sendMessage(lines.join('\n'));
    state[groupKey] = true;
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
