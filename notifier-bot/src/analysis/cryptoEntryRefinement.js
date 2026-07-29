// Crypto version of the "daily bias + lower-timeframe entry" test —
// unlike stocks (Yahoo caps 15m data at the last 60 days), OKX serves 15m
// history at least 2 years back, so 15m is actually usable here, which is
// what was asked for.
//
// Sample size caveat: to keep runtime reasonable, this pulls ~180 days of
// 15m data per pair (not the full 2y used for the daily signal backtest),
// so only signal occurrences within roughly the last ~170 days get a
// matching 15m window — a smaller, more recent sample than
// data/crypto-signal-validation.md's full 2-year numbers. Treat this as a
// directional check, not as strong evidence as the main backtest.
//
// Entry trigger tested: first 15m bar within 1 day (96 bars) after the
// daily signal's candle closes where low <= EMA9(15m) and close >
// EMA9(15m) — a pullback-then-bounce, same logic as the stock version.
// Hold: 192 15m-bars (~2 days) from the actual entry, matching the
// 2-day hold everything else in this bot uses.

const { getCandles } = require('../crypto/okx');
const { walkForwardOccurrences } = require('../stock/backtest');
const { getUniverse } = require('../crypto/universe');
const { ema } = require('../stock/signals');
const config = require('../config');

const TEST_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming'];
const FIFTEEN_MIN_SECONDS = 15 * 60;
const SEARCH_WINDOW_BARS = 96; // 1 day of 15m bars
const HOLD_BARS = 192; // ~2 days of 15m bars

function summarize(returns) {
  const n = returns.length;
  if (!n) return { trades: 0, winRate: null, expectancy: null };
  const wins = returns.filter((r) => r > 0);
  const winRate = (wins.length / n) * 100;
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const losses = returns.filter((r) => r <= 0);
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  return {
    trades: n,
    winRate: Math.round(winRate * 10) / 10,
    avgReturn: Math.round((returns.reduce((a, b) => a + b, 0) / n) * 100) / 100,
    expectancy: Math.round(((winRate / 100) * avgWin - (1 - winRate / 100) * Math.abs(avgLoss)) * 100) / 100,
  };
}

async function run({ days15m = 60, symbols = null, log = console.log } = {}) {
  const universe = symbols || (config.cryptoWatchlist.length ? config.cryptoWatchlist : getUniverse());
  const baselineReturns = {};
  const refinedReturns = {};
  const missedCount = {};
  const totalSetups = {};
  let symbolsUsed = 0;

  for (const symbol of universe) {
    let daily;
    let fine;
    try {
      daily = await getCandles(symbol, '1D', 730, { pauseMs: 100 });
      fine = await getCandles(symbol, '15m', days15m * 96, { pauseMs: 150 });
    } catch (err) {
      log(`[cryptoEntryRefinement] skip ${symbol}: ${err.message}`);
      continue;
    }
    if (daily.length < 100 || fine.length < 500) continue;
    symbolsUsed += 1;
    log(`[cryptoEntryRefinement] ${symbol}: fetched ${daily.length} daily + ${fine.length} 15m bars`);

    const fineCloses = fine.map((c) => c.close);
    const ema9 = ema(fineCloses, 9);

    const occurrences = walkForwardOccurrences(daily, 55);
    for (const kind of TEST_KINDS) {
      const hits = occurrences[kind] || [];
      for (const hit of hits) {
        const i = hit.index;
        if (i + 2 >= daily.length) continue;
        const sessionStart = daily[i].time; // crypto daily candle already closes at this ts (UTC cutoff)
        const sessionEnd = sessionStart + SEARCH_WINDOW_BARS * FIFTEEN_MIN_SECONDS;

        const baselineEntry = daily[i].close;
        const baselineExit = daily[i + 2].close;
        if (!(baselineEntry > 0)) continue;
        const baselineReturn = ((baselineExit - baselineEntry) / baselineEntry) * 100;

        // only test occurrences that fall within our 15m data window
        if (sessionStart < fine[0].time || sessionEnd > fine[fine.length - 1].time) continue;

        totalSetups[kind] = (totalSetups[kind] || 0) + 1;

        let entryIdx = null;
        for (let j = 0; j < fine.length; j++) {
          if (fine[j].time < sessionStart || fine[j].time >= sessionEnd) continue;
          const e = ema9[j];
          if (!Number.isFinite(e)) continue;
          if (fine[j].low <= e && fine[j].close > e) {
            entryIdx = j;
            break;
          }
        }

        if (entryIdx === null) {
          missedCount[kind] = (missedCount[kind] || 0) + 1;
          continue;
        }

        const exitIdx = Math.min(fine.length - 1, entryIdx + HOLD_BARS);
        if (exitIdx <= entryIdx) continue;
        const refinedEntry = fine[entryIdx].close;
        const refinedExit = fine[exitIdx].close;
        if (!(refinedEntry > 0)) continue;
        const refinedReturn = ((refinedExit - refinedEntry) / refinedEntry) * 100;

        if (!baselineReturns[kind]) baselineReturns[kind] = [];
        if (!refinedReturns[kind]) refinedReturns[kind] = [];
        baselineReturns[kind].push(baselineReturn);
        refinedReturns[kind].push(refinedReturn);
      }
    }
  }

  return { symbolsUsed, baselineReturns, refinedReturns, missedCount, totalSetups };
}

if (require.main === module) {
  const days15m = Number(process.argv[2]) || 60;
  run({ days15m }).then(({ symbolsUsed, baselineReturns, refinedReturns, missedCount, totalSetups }) => {
    console.log(`\nCrypto entry refinement test (~${days15m}d window, 15m entry) — ${symbolsUsed} pairs\n`);
    for (const kind of TEST_KINDS) {
      const total = totalSetups[kind] || 0;
      const missed = missedCount[kind] || 0;
      const filled = total - missed;
      console.log(`--- ${kind} ---`);
      console.log(`  setups: ${total}, filled: ${filled} (${total ? Math.round((filled / total) * 1000) / 10 : 0}%), missed: ${missed}`);
      console.log(`  baseline (enter at signal close):     ${JSON.stringify(summarize(baselineReturns[kind] || []))}`);
      console.log(`  refined  (enter at 15m EMA9 bounce):   ${JSON.stringify(summarize(refinedReturns[kind] || []))}`);
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run };
