// Daily orchestration job: scan stocks + crypto, filter to the
// data-validated signal kinds (config.alertStockKinds / alertCryptoKinds),
// attach an ATR-based entry/stop/target, flag (not skip) imminent
// earnings, and push everything to Telegram. Meant to be run once a day —
// see README.md for how this gets scheduled.

const config = require('./config');
const { sendMessage } = require('./telegram');
const stockUniverse = require('./stock/universe');
const { getChart, getNextEarningsDate } = require('./stock/yahoo');
const { detectStockSignals } = require('./stock/signals');
const cryptoUniverse = require('./crypto/universe');
const { getDailyCandles, getFundingRate } = require('./crypto/okx');
const { detectCryptoSignals } = require('./crypto/signals');
const { riskPlanFor } = require('./risk');
const { formatStockAlert, formatCryptoAlert } = require('./format');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scanStocks() {
  const universe = stockUniverse.getUniverse();
  const alerts = [];
  for (const entry of universe) {
    try {
      const chart = await getChart(entry.symbol, '1y', '1d');
      if (chart.candles.length < 60) continue;
      const { signals } = detectStockSignals(chart.candles);
      const matched = signals.filter((s) => config.alertStockKinds.includes(s.kind));
      if (!matched.length) continue;

      let earningsWarning = null;
      const earningsDate = await getNextEarningsDate(entry.symbol);
      if (earningsDate) {
        const daysUntil = Math.round((earningsDate.getTime() - Date.now()) / 86_400_000);
        if (daysUntil >= 0 && daysUntil <= config.earningsGuardDays) {
          earningsWarning = `Earnings in ${daysUntil} day(s) (${earningsDate.toISOString().slice(0, 10)}) — gap risk over your hold window. Alert is NOT suppressed; you decide.`;
        }
      }

      const plan = riskPlanFor(chart.candles);
      for (const signal of matched) {
        alerts.push({
          symbol: entry.symbol,
          text: formatStockAlert({ symbol: entry.symbol, name: entry.name, signal, plan, earningsWarning }),
        });
      }
    } catch (err) {
      console.error(`[job] stock ${entry.symbol} failed:`, err.message);
    }
    await sleep(150); // be polite to Yahoo's public endpoint
  }
  return alerts;
}

async function scanCrypto() {
  const universe = cryptoUniverse.getUniverse();
  const alerts = [];
  for (const symbol of universe) {
    try {
      const candles = await getDailyCandles(symbol, 300);
      if (candles.length < 60) continue;
      const funding = await getFundingRate(symbol).catch(() => null);
      const { signals } = detectCryptoSignals(candles, funding);
      const matched = signals.filter((s) => s.kind === 'funding-extreme' || config.alertCryptoKinds.includes(s.kind));
      if (!matched.length) continue;

      const plan = riskPlanFor(candles);
      for (const signal of matched) {
        alerts.push({ symbol, text: formatCryptoAlert({ symbol, signal, plan }) });
      }
    } catch (err) {
      console.error(`[job] crypto ${symbol} failed:`, err.message);
    }
    await sleep(150);
  }
  return alerts;
}

async function main() {
  const startedAt = new Date();
  const [stockAlerts, cryptoAlerts] = await Promise.all([scanStocks(), scanCrypto()]);
  const all = [...stockAlerts, ...cryptoAlerts];
  console.log(`[job] ${all.length} alert(s) found (${stockAlerts.length} stock, ${cryptoAlerts.length} crypto)`);

  for (const alert of all) {
    await sendMessage(alert.text);
    await sleep(500); // Telegram rate-limit courtesy
  }

  const stamp = startedAt.toISOString().slice(0, 16).replace('T', ' ');
  const summary = all.length
    ? `Scan selesai (${stamp} UTC): ${all.length} alert dikirim di atas.`
    : `Scan selesai (${stamp} UTC): tidak ada sinyal hari ini.`;
  await sendMessage(summary);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[job] fatal:', err);
    process.exit(1);
  });
}

module.exports = { scanStocks, scanCrypto, main };
