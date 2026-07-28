// Daily orchestration job: scan stocks + crypto, filter to the
// data-validated signal kinds (config.alertStockKinds / alertCryptoKinds —
// long-only by design, see data/*-signal-validation.md for why bearish
// mirrors aren't enabled), attach an ATR-based entry/stop/target + a
// Long/Short direction label, attach a couple of news headlines per
// alert, flag (not skip) imminent earnings, and push everything to
// Telegram. Also sends a separate H-1 reminder: tomorrow's major macro
// releases, earnings across the whole watchlist (not just symbols with a
// live signal), and any token unlocks you've noted in
// data/token-unlocks.json. Meant to run once a day — see README.md.

const config = require('./config');
const { sendMessage } = require('./telegram');
const stockUniverse = require('./stock/universe');
const { getChart, getNextEarningsDate } = require('./stock/yahoo');
const { detectStockSignals } = require('./stock/signals');
const cryptoUniverse = require('./crypto/universe');
const { getDailyCandles, getFundingRate } = require('./crypto/okx');
const { detectCryptoSignals } = require('./crypto/signals');
const { riskPlanFor } = require('./risk');
const { formatStockAlert, formatCryptoAlert, formatDailyReminder } = require('./format');
const { getStockNews, getCryptoNews } = require('./news');
const { getTomorrowMacroEvents, tomorrowYmd } = require('./macro');
const { getTomorrowUnlocks } = require('./tokenUnlocks');

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
      const news = await getStockNews(entry.symbol, 2);
      for (const signal of matched) {
        alerts.push({
          symbol: entry.symbol,
          text: formatStockAlert({ symbol: entry.symbol, name: entry.name, signal, plan, earningsWarning, news }),
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
      const matched = signals.filter((s) => s.kind === 'funding-extreme' ? false : config.alertCryptoKinds.includes(s.kind));
      // funding-extreme is untested (see README) — informational only, not
      // wired to alert by default. Flip the line above to include it once
      // it's backtested, or handle it as its own lower-priority message.
      if (!matched.length) continue;

      const plan = riskPlanFor(candles);
      const coinName = symbol.split('-')[0];
      const news = await getCryptoNews(`${coinName} crypto`, 2);
      for (const signal of matched) {
        alerts.push({ symbol, text: formatCryptoAlert({ symbol, signal, plan, news }) });
      }
    } catch (err) {
      console.error(`[job] crypto ${symbol} failed:`, err.message);
    }
    await sleep(200);
  }
  return alerts;
}

async function scanEarningsTomorrow(universe) {
  const tomorrow = tomorrowYmd();
  const hits = [];
  for (const entry of universe) {
    try {
      const date = await getNextEarningsDate(entry.symbol);
      if (date && date.toISOString().slice(0, 10) === tomorrow) {
        hits.push({ symbol: entry.symbol, name: entry.name });
      }
    } catch {
      // best-effort; skip on failure
    }
    await sleep(150);
  }
  return hits;
}

async function buildDailyReminder(stockUniverseList) {
  const [macroEvents, earningsTomorrow, tokenUnlocksTomorrow] = await Promise.all([
    getTomorrowMacroEvents(),
    scanEarningsTomorrow(stockUniverseList),
    Promise.resolve(getTomorrowUnlocks()),
  ]);
  return formatDailyReminder({ macroEvents, earningsTomorrow, tokenUnlocksTomorrow, dateYmd: tomorrowYmd() });
}

async function main() {
  const startedAt = new Date();
  const stockUniverseList = stockUniverse.getUniverse();

  const reminder = await buildDailyReminder(stockUniverseList);
  if (reminder) await sendMessage(reminder);

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

module.exports = { scanStocks, scanCrypto, scanEarningsTomorrow, buildDailyReminder, main };
