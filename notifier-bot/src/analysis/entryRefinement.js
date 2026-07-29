// Tests the "daily candle sets bias, lower timeframe refines entry" idea:
// after a validated daily signal fires (close of day T), instead of
// entering immediately at that close (the baseline this whole bot is
// built on), wait for a pullback-and-bounce off a short EMA on an hourly
// chart during day T+1, enter there instead, and compare.
//
// Timeframe note: 15-minute bars were the original ask, but Yahoo's public
// chart API only serves 15m data for the last 60 days — nowhere near
// enough for a real backtest sample. Hourly bars go back ~2 years, so
// that's what's used here; both the baseline and refined-entry numbers
// below are recomputed over that same shorter 2-year window (not the 10y
// figures from data/stock-signal-validation.md) so the comparison is
// apples-to-apples.
//
// Entry trigger tested: first hourly bar in day T+1's session where
// low <= EMA9(hourly) and close > EMA9(hourly) — a pullback-then-bounce.
// If no such bar occurs during T+1, the setup is counted as MISSED
// (no fill), not as a loss — that's an important number on its own: if
// most breakouts never pull back, waiting for one means giving up most
// of your trades, not just getting a better price on all of them.
// Hold: 14 hourly bars (~2 trading sessions) from the actual entry.

const { getChart } = require('../stock/yahoo');
const { walkForwardOccurrences } = require('../stock/backtest');
const { getUniverse } = require('../stock/universe');
const { ema } = require('../stock/signals');

const TEST_KINDS = ['momentum', 'cup-forming', 'golden-cross'];
const HOLD_HOURLY_BARS = 14; // ~2 trading sessions at ~7 bars/session

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

async function run({ log = console.log } = {}) {
  const universe = getUniverse();
  const baselineReturns = {};
  const refinedReturns = {};
  const missedCount = {};
  const totalSetups = {};
  let symbolsUsed = 0;

  for (const entry of universe) {
    let daily;
    let hourly;
    try {
      daily = (await getChart(entry.symbol, '2y', '1d')).candles;
      hourly = (await getChart(entry.symbol, '2y', '1h')).candles;
    } catch (err) {
      log(`[entryRefinement] skip ${entry.symbol}: ${err.message}`);
      continue;
    }
    if (daily.length < 100 || hourly.length < 200) continue;
    symbolsUsed += 1;

    const hourlyCloses = hourly.map((c) => c.close);
    const ema9 = ema(hourlyCloses, 9);

    const occurrences = walkForwardOccurrences(daily, 55);
    for (const kind of TEST_KINDS) {
      const hits = occurrences[kind] || [];
      for (const hit of hits) {
        const i = hit.index;
        if (i + 2 >= daily.length) continue; // need T+1 and T+2 daily bars to bound the session
        const sessionStart = daily[i + 1].time;
        const sessionEnd = daily[i + 2].time;

        // baseline: enter at close of day T, hold 2 days (same rule as the main backtest)
        const baselineEntry = daily[i].close;
        const baselineExit = daily[i + 2].close;
        if (!(baselineEntry > 0)) continue;
        const baselineReturn = ((baselineExit - baselineEntry) / baselineEntry) * 100;

        totalSetups[kind] = (totalSetups[kind] || 0) + 1;

        // find first hourly bar in T+1's session with a pullback-then-bounce off EMA9
        let entryIdx = null;
        for (let j = 0; j < hourly.length; j++) {
          if (hourly[j].time < sessionStart || hourly[j].time >= sessionEnd) continue;
          const e = ema9[j];
          if (!Number.isFinite(e)) continue;
          if (hourly[j].low <= e && hourly[j].close > e) {
            entryIdx = j;
            break;
          }
        }

        if (entryIdx === null) {
          missedCount[kind] = (missedCount[kind] || 0) + 1;
          continue;
        }

        const exitIdx = Math.min(hourly.length - 1, entryIdx + HOLD_HOURLY_BARS);
        if (exitIdx <= entryIdx) continue;
        const refinedEntry = hourly[entryIdx].close;
        const refinedExit = hourly[exitIdx].close;
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
  run().then(({ symbolsUsed, baselineReturns, refinedReturns, missedCount, totalSetups }) => {
    console.log(`\nEntry refinement test (2y window) — ${symbolsUsed} symbols\n`);
    for (const kind of TEST_KINDS) {
      const total = totalSetups[kind] || 0;
      const missed = missedCount[kind] || 0;
      const filled = total - missed;
      console.log(`--- ${kind} ---`);
      console.log(`  setups: ${total}, filled (pullback occurred): ${filled} (${total ? Math.round((filled / total) * 1000) / 10 : 0}%), missed: ${missed}`);
      console.log(`  baseline (enter at signal close, same filled subset): ${JSON.stringify(summarize(baselineReturns[kind] || []))}`);
      console.log(`  refined  (enter at EMA9 pullback bounce):            ${JSON.stringify(summarize(refinedReturns[kind] || []))}`);
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run };
