// Circuit breakers, ported in concept from freqtrade's plugins/protections.
//
// data/risk-management-plan.md already described circuit breakers, but as prose
// — nothing enforced them, so they only worked if remembered in the moment,
// which is exactly when they are least likely to be. These are the two that
// address failure modes this project has no other answer for:
//
//   cooldown      after a pair stops out, do not re-enter it immediately. The
//                 urge to get straight back into the position that just hurt
//                 is strongest precisely when judgement is worst.
//   stoploss guard  after N stop-outs across the book within a window, pause
//                 everything. A cluster of stops usually means the regime
//                 changed, not that the next signal will be luckier.
//
// Deliberately NOT ported: freqtrade's low_profit_pairs (disables pairs whose
// recent profit is poor) — with roughly one signal per pair every few weeks
// here, per-pair profit over any usable window is a handful of trades, and
// disabling on that is curve-fitting to noise.
//
// These read the alert log written by src/tracking.js. That log records what
// was ALERTED, not what was traded, so a stop is inferred from price rather
// than from a fill. That is an approximation and is stated in the report so it
// is not mistaken for execution data.

const fs = require('node:fs');
const path = require('node:path');

const LOG_PATH = path.join(__dirname, '..', 'data', 'alert-log.json');

// After a stop-out on a pair, skip new signals on it for this long.
const COOLDOWN_HOURS = 72;
// This many stop-outs across all pairs inside the lookback pauses everything.
const STOPLOSS_GUARD_TRIPS = 3;
const STOPLOSS_GUARD_LOOKBACK_HOURS = 168; // one week
const GUARD_PAUSE_HOURS = 48;

function loadLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function hoursSince(iso, now) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (now - t) / 3600000 : Infinity;
}

// An alert counts as stopped out when its recorded outcome says so. Entries
// without an outcome are ignored rather than assumed good — an unknown result
// is not evidence of anything.
function stopOuts(entries, now, withinHours) {
  return entries.filter((e) => e && e.outcome === 'stop'
    && hoursSince(e.closedAt || e.sentAt, now) <= withinHours);
}

// Returns { blocked, reason } for a specific pair at a specific moment.
function checkProtections(symbol, { now = Date.now(), entries = null } = {}) {
  const log = entries || loadLog();

  const recentStops = stopOuts(log, now, STOPLOSS_GUARD_LOOKBACK_HOURS);
  if (recentStops.length >= STOPLOSS_GUARD_TRIPS) {
    const newest = Math.max(...recentStops.map((e) => Date.parse(e.closedAt || e.sentAt) || 0));
    const sincePause = (now - newest) / 3600000;
    if (sincePause <= GUARD_PAUSE_HOURS) {
      return {
        blocked: true,
        reason: `stoploss guard: ${recentStops.length} stop-outs in the last ` +
          `${STOPLOSS_GUARD_LOOKBACK_HOURS / 24}d — trading paused for ` +
          `${Math.ceil(GUARD_PAUSE_HOURS - sincePause)}h more`,
      };
    }
  }

  const pairStops = stopOuts(log.filter((e) => e && e.symbol === symbol), now, COOLDOWN_HOURS);
  if (pairStops.length) {
    const newest = Math.max(...pairStops.map((e) => Date.parse(e.closedAt || e.sentAt) || 0));
    const remaining = COOLDOWN_HOURS - (now - newest) / 3600000;
    if (remaining > 0) {
      return {
        blocked: true,
        reason: `cooldown: ${symbol} stopped out ${Math.round(COOLDOWN_HOURS - remaining)}h ago — ` +
          `${Math.ceil(remaining)}h of cooldown left`,
      };
    }
  }

  return { blocked: false, reason: null };
}

module.exports = {
  checkProtections,
  COOLDOWN_HOURS,
  STOPLOSS_GUARD_TRIPS,
  STOPLOSS_GUARD_LOOKBACK_HOURS,
  GUARD_PAUSE_HOURS,
};
