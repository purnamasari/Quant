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

const { getCandles } = require('../crypto/binance');
const { walkForwardOccurrences } = require('../stock/backtest');
const { getUniverse } = require('../crypto/universe');
const { ema } = require('../stock/signals');
const config = require('../config');

const TEST_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming'];
const FIFTEEN_MIN_SECONDS = 15 * 60;
const SEARCH_WINDOW_BARS = 96; // 1 day of 15m bars
const HOLD_BARS = 192; // ~2 days of 15m bars
const BREAKOUT_LOOKBACK = 20; // ~5 hours of 15m bars for the range high

function summarize(timedReturns) {
  const returns = timedReturns.map((r) => r.value);
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

function splitHalves(timedReturns, midpoint) {
  return {
    first: timedReturns.filter((r) => r.time < midpoint),
    second: timedReturns.filter((r) => r.time >= midpoint),
  };
}

async function run({ days15m = 60, symbols = null, log = console.log } = {}) {
  const universe = symbols || (config.cryptoWatchlist.length ? config.cryptoWatchlist : getUniverse());
  const baselineReturns = {};
  const refinedReturns = {};
  const breakoutReturns = {};
  const missedCount = {};
  const breakoutMissedCount = {};
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
        // BUG FIX: OKX daily candle `time` is the OPEN timestamp (verified:
        // the still-forming candle's time is "now minus up to 24h", and
        // consecutive candles are exactly 86400s apart). Day i's CLOSE — the
        // moment the signal is actually confirmed and baselineEntry priced —
        // happens at daily[i+1].time (the next candle's open = this one's
        // close), NOT daily[i].time. Using daily[i].time here previously
        // started the pullback search a full day too early, overlapping
        // with the signal day itself before it even closed — a look-ahead
        // bug that invalidated every earlier run of this script.
        const sessionStart = daily[i + 1].time;
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

        if (entryIdx !== null) {
          const exitIdx = Math.min(fine.length - 1, entryIdx + HOLD_BARS);
          if (exitIdx > entryIdx) {
            const refinedEntry = fine[entryIdx].close;
            const refinedExit = fine[exitIdx].close;
            if (refinedEntry > 0) {
              const refinedReturn = ((refinedExit - refinedEntry) / refinedEntry) * 100;
              if (!baselineReturns[kind]) baselineReturns[kind] = [];
              if (!refinedReturns[kind]) refinedReturns[kind] = [];
              baselineReturns[kind].push({ time: sessionStart, value: baselineReturn });
              refinedReturns[kind].push({ time: sessionStart, value: refinedReturn });
            }
          }
        } else {
          missedCount[kind] = (missedCount[kind] || 0) + 1;
        }

        // Breakout-entry variant: first 15m bar in the same window whose
        // close exceeds the highest high of the prior BREAKOUT_LOOKBACK
        // bars — confirms continuation instead of waiting for a dip. Asked
        // specifically because cup-forming (a breakout pattern) got WORSE
        // with the pullback-wait approach above.
        let breakoutIdx = null;
        for (let j = 0; j < fine.length; j++) {
          if (fine[j].time < sessionStart || fine[j].time >= sessionEnd) continue;
          if (j < BREAKOUT_LOOKBACK) continue;
          const rangeHigh = Math.max(...fine.slice(j - BREAKOUT_LOOKBACK, j).map((c) => c.high));
          if (fine[j].close > rangeHigh) {
            breakoutIdx = j;
            break;
          }
        }
        if (breakoutIdx !== null) {
          const exitIdx = Math.min(fine.length - 1, breakoutIdx + HOLD_BARS);
          if (exitIdx > breakoutIdx) {
            const bEntry = fine[breakoutIdx].close;
            const bExit = fine[exitIdx].close;
            if (bEntry > 0) {
              const bReturn = ((bExit - bEntry) / bEntry) * 100;
              if (!breakoutReturns[kind]) breakoutReturns[kind] = [];
              breakoutReturns[kind].push({ time: sessionStart, value: bReturn });
            }
          }
        } else {
          breakoutMissedCount[kind] = (breakoutMissedCount[kind] || 0) + 1;
        }
      }
    }
  }

  return { symbolsUsed, baselineReturns, refinedReturns, breakoutReturns, missedCount, breakoutMissedCount, totalSetups };
}

if (require.main === module) {
  const days15m = Number(process.argv[2]) || 60;
  run({ days15m }).then(({ symbolsUsed, baselineReturns, refinedReturns, breakoutReturns, missedCount, breakoutMissedCount, totalSetups }) => {
    console.log(`\nCrypto entry refinement test (~${days15m}d window, 15m entry) — ${symbolsUsed} pairs\n`);
    const midpoint = Math.floor(Date.now() / 1000) - (days15m / 2) * 86400;
    for (const kind of TEST_KINDS) {
      const total = totalSetups[kind] || 0;
      const missed = missedCount[kind] || 0;
      const bMissed = breakoutMissedCount[kind] || 0;
      console.log(`--- ${kind} ---`);
      console.log(`  setups: ${total}, pullback-filled: ${total - missed}, breakout-filled: ${total - bMissed}`);
      console.log(`  baseline (all):        ${JSON.stringify(summarize(baselineReturns[kind] || []))}`);
      console.log(`  refined pullback (all):${JSON.stringify(summarize(refinedReturns[kind] || []))}`);
      console.log(`  refined breakout (all):${JSON.stringify(summarize(breakoutReturns[kind] || []))}`);

      const bHalves = splitHalves(baselineReturns[kind] || [], midpoint);
      const rHalves = splitHalves(refinedReturns[kind] || [], midpoint);
      const brHalves = splitHalves(breakoutReturns[kind] || [], midpoint);
      console.log(`  baseline yr1/yr2:      ${JSON.stringify(summarize(bHalves.first))} | ${JSON.stringify(summarize(bHalves.second))}`);
      console.log(`  pullback yr1/yr2:      ${JSON.stringify(summarize(rHalves.first))} | ${JSON.stringify(summarize(rHalves.second))}`);
      console.log(`  breakout yr1/yr2:      ${JSON.stringify(summarize(brHalves.first))} | ${JSON.stringify(summarize(brHalves.second))}`);
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run };
