// BTC market structure on 1D and 4H — a break-of-structure notification for
// the whole book, not a trade signal for one pair.
//
// WHAT THIS IS NOT: an edge. Measured over 730 daily and 1000 4H candles
// (src/analysis/structureFrequency.js), the forward move after a BTC BOS is
// indistinguishable from noise on both timeframes — every |t| below 1.7. The
// 4H BEARISH break is actually followed by a small positive drift (+1.07% at
// lookback 5, +1.15% at 8), i.e. the opposite of the intuitive read, and still
// not significant. So this alert exists to tell you the market changed shape,
// which is context for positions you already hold and for how much to trust a
// long signal today. It must never be worded as "enter here".
//
// PIVOT LOOKBACK IS CHOSEN BY FIRING RATE, not by backtest, because the thing
// being controlled is notification volume:
//
//   1D:  lb=1 -> 4.1/month   lb=5 -> 1.8/month   lb=8 -> 1.1/month
//   4H:  lb=1 -> 29.7/month  lb=5 -> 11/month    lb=8 -> 7.9/month
//
// detectBoS defaults to lookback 1 (a 3-bar fractal), which is right for the
// per-symbol signal kind and far too twitchy here — on 4H it fires roughly once
// a day. 1D uses 5 and 4H uses 8.
//
// The 4H break is additionally gated on agreeing with the current 1D bias.
// A 4H break against the higher-timeframe structure is the common case and the
// least informative one; requiring alignment roughly halves 4H volume and is
// the standard HTF-bias / LTF-confirmation framing.

const { detectBoS } = require('./smc');
const { getCandles } = require('./crypto/binance');

const DAILY_LOOKBACK = 5;
const FOUR_HOUR_LOOKBACK = 8;
const BENCHMARK = 'BTCUSDT';

// How far back to look for the most recent break when establishing the
// standing bias. Beyond this the structure is treated as unknown rather than
// asserting a bias from a break that happened months ago.
const BIAS_STALE_BARS = { '1D': 60, '4H': 90 };

// Walks backward from the newest bar to find the most recent break, so the
// caller learns both "did one just happen" and "what is the standing bias".
function lastBreak(candles, lookback, maxBarsBack) {
  const limit = Math.min(candles.length, maxBarsBack + 1);
  for (let back = 0; back < limit; back++) {
    const upTo = candles.length - back;
    const slice = candles.slice(0, upTo);
    const bos = detectBoS(slice, lookback);
    if (bos) {
      return {
        kind: bos.kind,
        direction: bos.kind === 'bos-bullish' ? 'bullish' : 'bearish',
        level: bos.level,
        barsAgo: back,
        time: candles[upTo - 1].time,
        close: candles[upTo - 1].close,
      };
    }
  }
  return null;
}

function analyse(candles, timeframe) {
  const lookback = timeframe === '1D' ? DAILY_LOOKBACK : FOUR_HOUR_LOOKBACK;
  const found = lastBreak(candles, lookback, BIAS_STALE_BARS[timeframe]);
  return {
    timeframe,
    lookback,
    bias: found ? found.direction : null,
    lastBreak: found,
    // A break on the most recent CLOSED bar is the only thing worth alerting
    // on. barsAgo 0 means it printed on the newest bar in the series.
    justBroke: Boolean(found && found.barsAgo === 0),
  };
}

// Returns structure for both timeframes plus the alerts that should fire.
// Accepts pre-fetched candles so a caller that already has them (cryptoJob
// fetches BTC daily for the regime) does not pay for them twice.
async function marketStructure({ dailyCandles = null, fourHourCandles = null } = {}) {
  const daily1d = dailyCandles || await getCandles(BENCHMARK, '1D', 300, { pauseMs: 100 });
  const h4 = fourHourCandles || await getCandles(BENCHMARK, '4H', 300, { pauseMs: 100 });

  const daily = analyse(daily1d, '1D');
  const fourHour = analyse(h4, '4H');

  const alerts = [];
  if (daily.justBroke) {
    alerts.push({ timeframe: '1D', ...daily.lastBreak, aligned: null });
  }
  // 4H only when it agrees with the standing daily bias — see header.
  if (fourHour.justBroke && daily.bias && fourHour.lastBreak.direction === daily.bias) {
    alerts.push({ timeframe: '4H', ...fourHour.lastBreak, aligned: true });
  }

  return { daily, fourHour, alerts, symbol: BENCHMARK };
}

module.exports = {
  marketStructure, analyse, lastBreak, DAILY_LOOKBACK, FOUR_HOUR_LOOKBACK, BENCHMARK,
};
