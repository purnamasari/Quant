// Same methodology as src/stock/backtest.js (universe-wide walk-forward,
// pooled expectancy per signal kind), applied to crypto daily candles from
// OKX. This validates whether reusing the stock-calibrated thresholds on
// crypto actually holds up, rather than assuming it does.
//
// NOT covered here: `funding-extreme` (crypto/signals.js) has no historical
// backtest — OKX's funding-rate-history endpoint exists and could support
// one, but it wasn't built tonight. Treat that specific signal as an
// untested heuristic until someone runs that analysis.

const { walkForwardOccurrences, forwardReturn, summarize } = require('../stock/backtest');
const { getDailyCandles } = require('./okx');
const { getUniverse } = require('./universe');

async function runCryptoBacktest({ days = 730, holdDays = 2, symbols = null, log = console.log } = {}) {
  const universe = symbols || getUniverse();
  const perKindReturns = {};
  let symbolsUsed = 0;

  for (const symbol of universe) {
    let candles;
    for (let attempt = 1; attempt <= 3 && !candles; attempt++) {
      try {
        candles = await getDailyCandles(symbol, days);
      } catch (err) {
        log(`[crypto backtest] ${symbol} attempt ${attempt} failed: ${err.message}`);
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    if (!candles) {
      log(`[crypto backtest] giving up on ${symbol} after 3 attempts`);
      continue;
    }
    if (candles.length < 100) {
      log(`[crypto backtest] skip ${symbol}: only ${candles.length} candles`);
      continue;
    }
    symbolsUsed += 1;

    const occurrences = walkForwardOccurrences(candles);
    for (const [kind, hits] of Object.entries(occurrences)) {
      if (!perKindReturns[kind]) perKindReturns[kind] = [];
      for (const hit of hits) {
        const ret = forwardReturn(candles, hit.index, holdDays);
        if (ret !== null) perKindReturns[kind].push(ret);
      }
    }
  }

  const summaryByKind = {};
  for (const [kind, returns] of Object.entries(perKindReturns)) {
    summaryByKind[kind] = summarize(returns);
  }
  return { symbolsUsed, holdDays, days, summaryByKind };
}

if (require.main === module) {
  const holdDays = Number(process.env.HOLD_DAYS || 2);
  runCryptoBacktest({ holdDays }).then((result) => {
    console.log(`\nCrypto universe backtest — ${result.symbolsUsed} pairs, ${result.days}d history, ${result.holdDays}-day hold\n`);
    const rows = Object.entries(result.summaryByKind).sort((a, b) => (b[1].expectancy ?? -999) - (a[1].expectancy ?? -999));
    for (const [kind, s] of rows) {
      console.log(
        `${kind.padEnd(16)} trades=${String(s.trades).padEnd(6)} winRate=${String(s.winRate).padEnd(6)}% avgReturn=${String(s.avgReturn).padEnd(7)}% expectancy=${s.expectancy}%`,
      );
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runCryptoBacktest };
