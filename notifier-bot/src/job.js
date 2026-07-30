// Daily orchestration job: scan STOCKS ONLY (crypto moved to
// cryptoJob.js, which runs every 15 minutes during waking hours instead —
// see that file's header for why). Filters to the data-validated signal
// kinds (config.alertStockKinds — long-only by design, see
// data/stock-signal-validation.md for why bearish mirrors aren't enabled),
// attaches an ATR-based entry/stop/target + a Long/Short direction label,
// attaches a couple of news headlines per alert, flags (not skips)
// imminent earnings, and pushes everything to Telegram. Also sends a
// separate H-1 reminder: tomorrow's major macro releases, earnings across
// the whole watchlist (not just symbols with a live signal), and any
// token unlocks noted in data/token-unlocks.json. Meant to run once a day
// — see README.md.

const config = require('./config');
const { sendMessage } = require('./telegram');
const stockUniverse = require('./stock/universe');
const { getChart, getNextEarningsDate } = require('./stock/yahoo');
const { detectStockSignals } = require('./stock/signals');
const { riskPlanFor } = require('./risk');
const { formatStockAlert, formatDailyReminder } = require('./format');
const { getStockNews } = require('./news');
const { getTomorrowMacroEvents, tomorrowYmd } = require('./macro');
const { getTomorrowUnlocks } = require('./tokenUnlocks');
const { convictionFor } = require('./conviction');
const { nowStampWithWib } = require('./time');
const { ChartRenderer } = require('./chart');
const { processPendingCallbacks } = require('./tracking');
const { deliverAlerts } = require('./deliverAlert');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scanStocks() {
  // No enabled kinds means the stock alert side is switched off (the shipped
  // default — see config.js). Returning before the universe loop matters: the
  // filter on line ~42 would already produce zero alerts, but only after 91
  // Yahoo chart fetches, and the run would then report "no signals today" as
  // if the scan had looked and found nothing.
  if (!config.alertStockKinds.length) return [];

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
        const conviction = convictionFor('stock', signal.kind);
        alerts.push({
          market: 'stock',
          symbol: entry.symbol,
          kind: signal.kind,
          direction: signal.direction,
          conviction: conviction.tier,
          candles: chart.candles,
          plan,
          signal,
          chartTitle: `${entry.symbol} — ${signal.label} [${signal.direction === 'short' ? 'SHORT' : 'LONG'}]`,
          text: formatStockAlert({ symbol: entry.symbol, name: entry.name, signal, plan, earningsWarning, news, conviction }),
        });
      }
    } catch (err) {
      console.error(`[job] stock ${entry.symbol} failed:`, err.message);
    }
    await sleep(150); // be polite to Yahoo's public endpoint
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

  // Catch up on any FOLLOW/SKIP button presses since the last run before
  // sending new alerts — see tracking.js for why this is delayed, not
  // real-time.
  const { processed } = await processPendingCallbacks();
  if (processed) console.log(`[job] recorded ${processed} FOLLOW/SKIP decision(s) since the last run`);

  const stockUniverseList = stockUniverse.getUniverse();

  const reminder = await buildDailyReminder(stockUniverseList);
  if (reminder) await sendMessage(reminder);

  const stocksEnabled = config.alertStockKinds.length > 0;
  const all = await scanStocks();
  console.log(stocksEnabled
    ? `[job] ${all.length} stock alert(s) found`
    : '[job] stock alerts disabled (no ALERT_STOCK_KINDS) — reminder only');

  const renderer = new ChartRenderer();
  try {
    await deliverAlerts(all, renderer);
  } finally {
    await renderer.close();
  }

  const stamp = nowStampWithWib(startedAt);
  // Three distinct states, deliberately not two: "nothing fired today" and
  // "we no longer look at stocks" mean different things to whoever reads it.
  let summary;
  if (!stocksEnabled) {
    summary = `Reminder harian terkirim (${stamp}). Alert saham nonaktif — sinyal saham tidak lebih baik dari entry acak (lihat data/stock-signal-validation.md). Sinyal crypto tetap jalan lewat cryptoJob.`;
  } else if (all.length) {
    summary = `Scan saham selesai (${stamp}): ${all.length} alert dikirim di atas.`;
  } else {
    summary = `Scan saham selesai (${stamp}): tidak ada sinyal hari ini.`;
  }
  await sendMessage(summary);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[job] fatal:', err);
    process.exit(1);
  });
}

module.exports = { scanStocks, scanEarningsTomorrow, buildDailyReminder, main };
