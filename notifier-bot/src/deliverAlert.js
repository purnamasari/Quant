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

const { sendMessage, sendPhoto } = require('./telegram');
const { makeAlertId, keyboardFor, recordAlert } = require('./tracking');
const { recordSignal } = require('./signalStore');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    try {
      const png = await renderer.render({
        candles: alert.candles,
        entry: alert.plan.entry,
        stop: alert.plan.stop,
        target: alert.plan.target,
        title: alert.chartTitle,
      });
      await sendPhoto(png, alert.chartTitle);
    } catch (err) {
      console.error(`[deliverAlert] chart render failed for ${alert.symbol}:`, err.message);
    }

    await sendMessage(alert.text, { replyMarkup: keyboardFor(alertId) });
    recordAlert({
      id: alertId,
      market: alert.market,
      symbol: alert.symbol,
      kind: alert.kind,
      direction: alert.direction,
      conviction: alert.conviction,
    });
    recordSignal({ ...alert, notified: true });
    notified += 1;
    await sleep(500); // Telegram rate-limit courtesy
  }

  return { notified, silent };
}

module.exports = { deliverAlerts };
