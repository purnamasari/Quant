// Turns an assembled alert into forecast input. Lives here rather than in
// deliverAlert.js because the forecast is now built once at scan time and
// carried on the alert object end-to-end — the chart renderer and the caption
// both read the same projection, so they cannot disagree.
//
// Seeded per symbol+kind+day so the same alert always renders the same
// picture: a projection that changes on every re-render invites reading it as
// a live prediction.
//
// Never allowed to break delivery: a chart with no forecast is a normal chart,
// a thrown forecast is a missed alert.

const { generateForecast, djb2 } = require('./engine');

function buildForecastForAlert(alert) {
  try {
    if (!alert?.plan) return null;
    const candles = Array.isArray(alert.candles) ? alert.candles.slice(-60) : [];
    // Below ~20 bars the ATR and drift estimates are noise, not a projection.
    if (candles.length < 20) return null;
    const today = new Date().toISOString().slice(0, 10);
    return generateForecast({
      candles,
      direction: alert.direction === 'short' ? 'short' : 'long',
      takeProfit: alert.plan.target,
      stopLoss: alert.plan.stop,
      entry: alert.plan.entry,
      regime: alert.regime || null,
      signalStrength: Math.min(1, (alert.signal?.score || 0) / 20),
      seed: djb2(`${alert.symbol}|${alert.kind}|${today}`),
    });
  } catch (err) {
    console.log(`[forecast] skip for ${alert?.symbol} ${alert?.kind}: ${err.message}`);
    return null;
  }
}

module.exports = { buildForecastForAlert, djb2 };
