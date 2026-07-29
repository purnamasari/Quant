// Crypto scan — runs every 15 minutes during waking hours (see the
// separate Routine: cron `*/15 22-23,0-14 * * *` UTC = ~05:00-22:00 WIB),
// unlike the once-daily stock job.js. Crypto trades 24/7 but our signal
// still only truly finalizes at the fixed UTC daily candle cutoff
// (00:00 UTC = 07:00 WIB) — scanning every 15 minutes doesn't create a new
// timeframe/threshold, it just catches the SAME daily signal sooner:
//   - PROVISIONAL: seen while today's candle is still forming (confirm=0).
//     Can still change or disappear before the day closes — not backtested
//     behavior, purely a heads-up.
//   - CONFIRMED: seen after today's candle has closed. This is the signal
//     the backtest actually validated.
// Dedup (src/cryptoDedup.js) sends at most one PROVISIONAL and one
// CONFIRMED ping per symbol+kind+day, so 15-minute polling doesn't spam
// the same detection repeatedly.

const config = require('./config');
const { sendMessage } = require('./telegram');
const cryptoUniverse = require('./crypto/universe');
const { getDailyCandles, getFundingRate } = require('./crypto/okx');
const { detectCryptoSignals } = require('./crypto/signals');
const { riskPlanFor } = require('./risk');
const { formatCryptoAlert } = require('./format');
const { getCryptoNews } = require('./news');
const { convictionFor } = require('./conviction');
const { nowStampWithWib } = require('./time');
const { ChartRenderer } = require('./chart');
const { shouldSend } = require('./cryptoDedup');
const { deliverAlerts } = require('./deliverAlert');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scanCrypto() {
  const universe = cryptoUniverse.getUniverse();
  const alerts = [];
  for (const symbol of universe) {
    try {
      const candles = await getDailyCandles(symbol, 300);
      if (candles.length < 60) continue;
      const provisional = candles[candles.length - 1].confirmed === false;

      const funding = await getFundingRate(symbol).catch(() => null);
      const { signals } = detectCryptoSignals(candles, funding);
      const matched = signals.filter((s) => (s.kind === 'funding-extreme' ? false : config.alertCryptoKinds.includes(s.kind)));
      if (!matched.length) continue;

      const plan = riskPlanFor(candles);
      const coinName = symbol.split('-')[0];
      const news = await getCryptoNews(`${coinName} crypto`, 2);
      for (const signal of matched) {
        const status = provisional ? 'provisional' : 'confirmed';
        if (!shouldSend(symbol, signal.kind, status)) continue;

        const conviction = convictionFor('crypto', signal.kind);
        alerts.push({
          market: 'crypto',
          symbol,
          kind: signal.kind,
          direction: signal.direction,
          conviction: conviction.tier,
          candles,
          plan,
          signal,
          chartTitle: `${symbol} — ${signal.label} [${signal.direction === 'short' ? 'SHORT' : 'LONG'}]${provisional ? ' (provisional)' : ''}`,
          text: formatCryptoAlert({ symbol, signal, plan, news, conviction, provisional }),
        });
      }
    } catch (err) {
      console.error(`[cryptoJob] ${symbol} failed:`, err.message);
    }
    await sleep(200);
  }
  return alerts;
}

async function main() {
  const startedAt = new Date();
  const alerts = await scanCrypto();
  console.log(`[cryptoJob] ${alerts.length} new alert(s) (after dedup) at ${nowStampWithWib(startedAt)}`);
  if (!alerts.length) return; // most 15-min checks find nothing new — expected, no need to message

  const renderer = new ChartRenderer();
  try {
    await deliverAlerts(alerts, renderer);
  } finally {
    await renderer.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[cryptoJob] fatal:', err);
    process.exit(1);
  });
}

module.exports = { scanCrypto, main };
