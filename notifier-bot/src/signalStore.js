// Dashboard feed: every signal the scan produced, whether or not it was pushed.
//
// There is no dashboard app in this repo yet, so "shown in the dashboard" is
// implemented as the thing a dashboard would read — an append-only JSON feed
// with the full scored signal, including the ones deliberately kept silent.
// Writing the store first means the dashboard, whenever it gets built, does not
// need the scan to change.
//
// This is deliberately NOT data/alert-log.json. That file records what was
// SENT and carries the FOLLOW/SKIP decisions attached to a Telegram message,
// so a silent signal has no place in it — a signal nobody saw cannot have been
// followed or skipped, and mixing them would corrupt the follow-through stats.

const fs = require('node:fs');
const path = require('node:path');
const { mirrorSignal } = require('./platformSignal');

const FILE = path.join(__dirname, '..', 'data', 'signal-feed.json');
const RETENTION_DAYS = 90;

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(rows) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, `${JSON.stringify(rows, null, 2)}\n`);
}

// `notified` is the whole point of this record: it separates "we never saw
// this setup" from "we saw it and chose not to interrupt you". Without it,
// reviewing a missed move later cannot distinguish a detector gap from a
// notification-policy decision.
function recordSignal(entry) {
  const rows = load();
  const row = {
    at: new Date().toISOString(),
    market: entry.market,
    symbol: entry.symbol,
    kind: entry.kind,
    direction: entry.direction,
    conviction: entry.conviction,
    baseConviction: entry.baseConviction ?? entry.conviction,
    regime: entry.regime ?? null,
    regimeAdjusted: Boolean(entry.regimeAdjusted),
    notified: Boolean(entry.notified),
    rank: entry.rank ?? null,
    stats: entry.stats ?? null,
    entry: entry.plan?.entry ?? null,
    stop: entry.plan?.stop ?? null,
    stopDistancePercent: entry.plan?.stopDistancePercent ?? null,
    holdDays: entry.plan?.holdDays ?? null,
    provisional: Boolean(entry.provisional),
  };
  rows.push(row);

  const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
  save(rows.filter((r) => new Date(r.at).getTime() >= cutoff));

  // Sprint 2 "balik arah": the same row is mirrored into Market Pulse's
  // append-only `signal_events`, so MP owns the fact rather than proxying
  // :8787 to read it back. Fire-and-forget and flag-gated
  // (PLATFORM_SIGNALS=0 by default) — the local JSON feed above stays the
  // authority here until the 48h dual-run reconciles to zero difference.
  mirrorSignal(row);
}

function recentSignals({ days = 7, notifiedOnly = false } = {}) {
  const cutoff = Date.now() - days * 86_400_000;
  return load()
    .filter((r) => new Date(r.at).getTime() >= cutoff)
    .filter((r) => !notifiedOnly || r.notified);
}

module.exports = { recordSignal, recentSignals, FILE };
