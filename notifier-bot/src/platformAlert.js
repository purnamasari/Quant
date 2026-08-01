// Sprint 1 "satu mulut" (market-pulse/docs/IMPLEMENTATION-PLAN.md §3 task 7).
//
// Posts an alert into Market Pulse's `alerts` table via its internal-key
// ingest endpoint, instead of (or alongside — see config.platformDelivery)
// this bot sending Telegram directly. MP's own delivery pass is the thing
// that actually calls Telegram; this module only writes the row.
//
// Every message MP eventually sends carries a deep link back to
// https://iq.heydewi.com/token/{SYMBOL} — that's appended by MP's
// `app/delivery/service.py`, not here, so it stays true regardless of which
// alert type or caller produced the row.

const config = require('./config');

function ingestUrl() {
  return `${config.platformApiBaseUrl}/api/v1/alerts/ingest`;
}

// `alert` shape:
//   type          — MP AlertType: 'daily_digest' | 'opportunity' | ...
//   symbol        — token symbol, e.g. 'BTCUSDT'
//   title         — short headline
//   body          — message body (plain text; MP wraps it in HTML)
//   severity      — 'info' | 'warning' | 'critical' (default 'info')
//   dedupeKey     — stable id, matches MP's alerts.dedupe_key UNIQUE constraint
//   source        — provenance tag (default 'quant')
//   deliveryState — 'suppressed' for shadow-mode dual-run; omit for 'pending'
async function postAlert({
  type,
  symbol,
  title,
  body,
  severity = 'info',
  dedupeKey,
  source = 'quant',
  deliveryState,
}) {
  if (!config.platformInternalApiKey || !config.platformInternalUserId) {
    console.warn('[platformAlert] missing PLATFORM_INTERNAL_API_KEY/PLATFORM_INTERNAL_USER_ID, skipping ingest');
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
      body: JSON.stringify({
        type,
        token_symbol: symbol,
        title,
        body,
        severity,
        dedupe_key: dedupeKey,
        source,
        ...(deliveryState ? { delivery_state: deliveryState } : {}),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      console.error('[platformAlert] ingest failed:', res.status, json.error || json);
      return { ok: false, status: res.status };
    }
    return { ok: true, data: json.data };
  } catch (err) {
    console.error('[platformAlert] ingest error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { postAlert };
