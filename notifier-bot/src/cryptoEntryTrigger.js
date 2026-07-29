// Extracted from src/analysis/cryptoEntryRefinement.js's validated
// pullback-entry rule (EMA9 bounce on 15m bars) — the same logic, used
// live in cryptoJob.js now that the backtest (2y, 7 pairs, split into two
// years) showed it beats immediate entry for ma-alignment, near-52w-high,
// and volume-surge specifically. cup-forming and bos-bullish deliberately
// do NOT use this — cup-forming got worse waiting (tested both pullback
// and breakout variants), and bos-bullish wasn't part of that test.
//
// No separate "pending" state file needed: each hourly cryptoJob.js run
// re-checks the fixed [sessionStart, sessionStart+1day) window against
// fresh 15m data. If the trigger hasn't fired yet, nothing is sent and
// nothing is recorded — the next hourly run just checks again. Once it
// fires (or the window has fully elapsed with no trigger), the existing
// per-day dedup (cryptoDedup.js) takes over so it isn't re-alerted.

const { ema } = require('./stock/signals');

const FIFTEEN_MIN_SECONDS = 15 * 60;
const SEARCH_WINDOW_BARS = 96; // 1 day of 15m bars

// fine: 15m candles covering at least [sessionStart, sessionStart+1day).
// sessionStart: unix seconds when the daily signal's candle closed.
// Returns { entryPrice, entryTime } if a pullback-bounce already occurred
// in the window, or null if not yet (or the window is still in the past
// with no trigger — caller decides whether to keep waiting based on time).
function findPullbackEntry(fine, sessionStart) {
  const sessionEnd = sessionStart + SEARCH_WINDOW_BARS * FIFTEEN_MIN_SECONDS;
  const closes = fine.map((c) => c.close);
  const ema9 = ema(closes, 9);
  for (let j = 0; j < fine.length; j++) {
    if (fine[j].time < sessionStart || fine[j].time >= sessionEnd) continue;
    const e = ema9[j];
    if (!Number.isFinite(e)) continue;
    if (fine[j].low <= e && fine[j].close > e) {
      return { entryPrice: fine[j].close, entryTime: fine[j].time };
    }
  }
  return null;
}

function windowExpired(sessionStart, now = Date.now() / 1000) {
  return now >= sessionStart + SEARCH_WINDOW_BARS * FIFTEEN_MIN_SECONDS;
}

module.exports = { findPullbackEntry, windowExpired, SEARCH_WINDOW_BARS };
