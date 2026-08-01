// Shared chart+message+tracking delivery, used by both the daily job.js
// (stocks) and cryptoJob.js (crypto, scanned more frequently).
//
// Delivery is two paths now, not one. Every signal is recorded to the
// dashboard feed; only HIGH and VERY HIGH additionally get a Telegram push
// with a rendered chart. The split exists because notification volume was the
// actual problem — one run sent 59 alerts and buried the rare tier that fires
// once every 6-10 days. A signal that trains you to ignore the bot costs more
// than the signal is worth.
//
// Chart rendering sits inside the notify branch on purpose. It is the most
// expensive step in the pipeline (a Chromium page per alert), and spending it
// on something nobody will be shown is pure waste.
//
// A push is ONE Telegram message: the chart as the photo, the full alert text
// as its caption, and the tracking buttons on that same message. It used to be
// two (photo, then text), which split every alert across a scroll boundary and
// put the buttons on a message with no picture.

const { sendMessage, sendPhoto } = require('./telegram');
const { makeAlertId, keyboardFor, recordAlert } = require('./tracking');
const { recordSignal } = require('./signalStore');
const { postAlert } = require('./platformAlert');
const config = require('./config');

// Telegram's photo caption limit. Longer captions are rejected outright, so
// the text is truncated rather than lost — formatCryptoAlert is budgeted to
// stay well under this, and the truncation is the backstop for news headlines
// or warnings that run long.
const CAPTION_LIMIT = 1024;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 'very-high' is the rarer, stronger tier — worth 'warning' so it doesn't get
// held by MP's quiet hours the way a plain 'info' opportunity would.
function platformSeverity(conviction) {
  return conviction === 'very-high' ? 'warning' : 'info';
}

async function deliverAlerts(alerts, renderer) {
  let notified = 0;
  let silent = 0;

  for (const alert of alerts) {
    // Default to notifying when the caller did not decide. Stock alerts never
    // set `notify`, and silently muting a caller that never opted in would be a
    // behaviour change disguised as a default.
    const notify = alert.notify !== false;

    if (!notify) {
      silent += 1;
      recordSignal({ ...alert, notified: false });
      console.log(`[deliverAlert] ${alert.symbol} ${alert.kind} — ${alert.conviction}, dashboard only (no push)`);
      continue;
    }

    const alertId = makeAlertId(alert.market, alert.symbol, alert.kind);

    const caption = alert.text.length > CAPTION_LIMIT
      ? `${alert.text.slice(0, CAPTION_LIMIT - 3)}…`
      : alert.text;

    // Sprint 1 "satu mulut": in 'live' mode MP's platform bot is the one
    // sending, so this bot's own Telegram push is skipped entirely — sending
    // both would be the double-notify R5 warns about. 'off'/'shadow' keep
    // this legacy push unchanged.
    if (config.platformDelivery !== 'live') {
      try {
        const png = await renderer.render({
          candles: alert.candles,
          entry: alert.plan.entry,
          stop: alert.plan.stop,
          target: alert.plan.target,
          title: alert.chartTitle,
          // Attached at scan time (crypto) so the drawn projection matches the
          // odds in the caption. Stock alerts carry none and render plain.
          forecast: alert.forecast || null,
        });
        await sendPhoto(png, caption, { replyMarkup: keyboardFor(alertId) });
      } catch (err) {
        // A failed render must not swallow the alert: fall back to text-only so
        // the signal and its buttons still arrive.
        console.error(`[deliverAlert] chart render failed for ${alert.symbol}:`, err.message);
        await sendMessage(alert.text, { replyMarkup: keyboardFor(alertId) });
      }

      recordAlert({
        id: alertId,
        market: alert.market,
        symbol: alert.symbol,
        kind: alert.kind,
        direction: alert.direction,
        conviction: alert.conviction,
      });
    }

    if (config.platformDelivery === 'shadow' || config.platformDelivery === 'live') {
      await postAlert({
        type: 'opportunity',
        symbol: alert.symbol,
        title: `${alert.symbol} — ${alert.kind}`,
        body: alert.text,
        severity: platformSeverity(alert.conviction),
        dedupeKey: alertId,
        source: 'quant',
        // shadow: legacy already sent above, so MP must never also send —
        // 'suppressed' makes the ingested row count-only, for the 48h
        // reconciliation in the Sprint 1 exit criteria.
        // live: legacy was skipped above, so leave delivery_state at its
        // 'pending' default so MP's delivery pass is the one that sends.
        deliveryState: config.platformDelivery === 'shadow' ? 'suppressed' : undefined,
      });
    }

    recordSignal({ ...alert, notified: true });
    notified += 1;
    await sleep(500); // Telegram rate-limit courtesy
  }

  return { notified, silent };
}

module.exports = { deliverAlerts };
