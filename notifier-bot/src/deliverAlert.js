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
const { generateForecast, djb2 } = require('./forecast/engine');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Projected path drawn after the last real candle. Seeded per symbol+kind+day
// so the same alert always renders the same picture — a projection that
// changes on every re-render invites reading it as a live prediction.
//
// Never allowed to break delivery: a chart with no forecast is a normal chart,
// a thrown forecast is a missed alert.
function buildForecastForAlert(alert) {
  try {
    if (!alert?.plan || !Array.isArray(alert.candles) || !alert.candles.length) return null;
    const day = new Date().toISOString().slice(0, 10);
    return generateForecast({
      candles: alert.candles.slice(-60),
      direction: alert.direction === 'short' ? 'short' : 'long',
      takeProfit: alert.plan.target,
      stopLoss: alert.plan.stop,
      entry: alert.plan.entry,
      regime: alert.regime || null,
      signalStrength: Math.min(1, (alert.signal?.score || 0) / 20),
      seed: djb2(`${alert.symbol}|${alert.kind}|${day}`),
    });
  } catch (err) {
    console.error(`[forecast] skipped for ${alert?.symbol}: ${err.message}`);
    return null;
  }
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
      const forecast = buildForecastForAlert(alert);
      const png = await renderer.render({
        candles: alert.candles,
        entry: alert.plan.entry,
        stop: alert.plan.stop,
        target: alert.plan.target,
        title: alert.chartTitle,
        forecast,
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
