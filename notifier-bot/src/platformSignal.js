// Sprint 2 "balik arah" (market-pulse/docs/IMPLEMENTATION-PLAN.md §3 task 3).
//
// Mirrors every signal this bot records into Market Pulse's `signal_events`
// table, so MP owns the fact instead of proxying :8787 to read it back.
//
// The call site is signalStore#recordSignal — the one place that already sees
// EVERY signal, including the silent ones nobody was notified about. Wiring it
// to deliverAlert's push branch instead would have shipped a feed that quietly
// omits exactly the signals worth reviewing later.
//
// Two invariants this module must never break:
//   1. It never throws into the detection path. A signal that was detected but
//      failed to POST is a lost row, not a lost scan.
//   2. It is fire-and-forget. recordSignal is synchronous and sits inside the
//      scan loop; awaiting an HTTP round trip per signal would slow the scan
//      for a mirror nobody is reading yet.

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const config = require('./config');

// Provenance, captured once at boot: which build of this bot produced the
// signal. Re-reading git per signal would put a subprocess in the scan loop,
// and the sha cannot change without a restart anyway.
const SOURCE_VERSION = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
})();

// Daily-bar detectors with a multi-day hold (HOLD_DAYS defaults to 14) — 'swing'
// is the honest horizon for all of them. When a detector ever runs intraday it
// passes its own.
const DEFAULT_HORIZON = 'swing';

// MP's column vocabulary uses underscores ('very_high'); this bot's tiers use
// hyphens ('very-high'). Normalise the column, keep the raw value in features.
function normalizeConviction(value) {
  if (!value) return null;
  return String(value).trim().toLowerCase().replace(/-/g, '_');
}

function dayStamp(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

// '{source}|{symbol}|{side}|{horizon}|{YYYY-MM-DD}|{kind}' — the UNIQUE key
// that makes ingest idempotent. Same setup re-detected on the same day is the
// same fact, so a retry (or a second scan pass) collapses instead of doubling.
function dedupKey({ source, symbol, side, horizon, day, kind }) {
  return [source, symbol, side, horizon, day, kind].join('|');
}

function ingestUrl() {
  return `${config.platformApiBaseUrl}/api/v1/ingest/signal`;
}

// `entry` is the row signalStore just appended to the feed — the trimmed
// record, NOT the raw alert object, which also carries the candle array and
// the rendered chart inputs and would bloat every JSONB row for nothing.
//
// Mapping is deliberately thin: four fields are promoted to columns because MP
// queries on them; the row goes to `features` verbatim and is NOT
// reinterpreted (plan §2.1: features is the source payload, untouched). The
// promoted fields stay in features too — that redundancy is what lets MP serve
// the dashboard feed byte-faithfully from its own table.
function toSignalEvent(entry) {
  const detectedAt = entry.at || new Date().toISOString();
  const symbol = String(entry.symbol || '').toUpperCase();
  const side = String(entry.direction || '').toLowerCase();
  const horizon = entry.horizon || DEFAULT_HORIZON;
  const day = dayStamp(detectedAt);
  return {
    source: 'quant',
    source_version: SOURCE_VERSION,
    symbol,
    side,
    horizon,
    kind: entry.kind,
    conviction: normalizeConviction(entry.conviction),
    detected_at: detectedAt,
    expires_at: null,
    features: entry,
    dedup_key: dedupKey({ source: 'quant', symbol, side, horizon, day, kind: entry.kind }),
  };
}

async function postSignal(entry) {
  if (config.platformSignals !== '1') return { ok: false, skipped: true };
  if (!config.platformInternalApiKey || !config.platformInternalUserId) {
    console.warn('[platformSignal] missing PLATFORM_INTERNAL_API_KEY/PLATFORM_INTERNAL_USER_ID, skipping ingest');
    return { ok: false, skipped: true };
  }
  if (!entry || !entry.symbol || !entry.kind || !entry.direction) {
    console.warn('[platformSignal] entry missing symbol/kind/direction, skipping ingest');
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch(ingestUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': config.platformInternalApiKey,
        'X-Internal-User-Id': config.platformInternalUserId,
      },
      body: JSON.stringify(toSignalEvent(entry)),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      console.error('[platformSignal] ingest failed:', res.status, json.error || json);
      return { ok: false, status: res.status };
    }
    return { ok: true, inserted: Boolean(json.data && json.data.inserted) };
  } catch (err) {
    console.error('[platformSignal] ingest error:', err.message);
    return { ok: false, error: err.message };
  }
}

// Fire-and-forget wrapper for the synchronous call site. Every rejection path
// inside postSignal is already caught; this .catch is the belt to that braces.
function mirrorSignal(entry) {
  if (config.platformSignals !== '1') return;
  postSignal(entry).catch((err) => {
    console.error('[platformSignal] unexpected ingest error:', err.message);
  });
}

module.exports = { mirrorSignal, postSignal, toSignalEvent, dedupKey, SOURCE_VERSION };
