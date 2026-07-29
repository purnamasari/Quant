// Shared chart+message+tracking delivery, used by both the daily job.js
// (stocks) and cryptoJob.js (crypto, scanned more frequently).

const { sendMessage, sendPhoto } = require('./telegram');
const { makeAlertId, keyboardFor, recordAlert } = require('./tracking');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deliverAlerts(alerts, renderer) {
  for (const alert of alerts) {
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
    await sleep(500); // Telegram rate-limit courtesy
  }
}

module.exports = { deliverAlerts };
