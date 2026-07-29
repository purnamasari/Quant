// Proper R-multiple backtest for the signals currently in
// config.alertStockKinds / alertCryptoKinds — instead of raw % return
// (what data/*-signal-validation.md reports), this simulates the actual
// stop/target defined by risk.js's riskPlanFor (ATR*1.5 stop, 1.8 R:R
// target) day-by-day over the hold window, same as the trade a live
// alert would actually propose. Answers: does any validated signal
// average 0.5-1R expectancy, not just "positive % return"?

const { walkForwardOccurrences } = require('../stock/backtest');
const { atr } = require('../risk');

const ATR_STOP_MULTIPLIER = 1.5;
const MIN_REWARD_RISK = 1.8;

// Returns the R-multiple achieved: -1 if stopped out, +MIN_REWARD_RISK if
// target hit, or the time-exit R (could be anything) if neither happens
// within maxHoldDays.
function simulateRMultiple(candles, entryIndex, direction, maxHoldDays = 2) {
  const entry = candles[entryIndex].close;
  const a = atr(candles.slice(0, entryIndex + 1), 14) ?? entry * 0.02;
  if (!(a > 0)) return null;
  const stopDistance = a * ATR_STOP_MULTIPLIER;
  const stop = direction === 'short' ? entry + stopDistance : entry - stopDistance;
  const target = direction === 'short' ? entry - stopDistance * MIN_REWARD_RISK : entry + stopDistance * MIN_REWARD_RISK;

  for (let d = 1; d <= maxHoldDays; d++) {
    const idx = entryIndex + d;
    if (idx >= candles.length) break;
    const bar = candles[idx];
    if (direction === 'short') {
      if (bar.high >= stop) return -1;
      if (bar.low <= target) return MIN_REWARD_RISK;
    } else {
      if (bar.low <= stop) return -1;
      if (bar.high >= target) return MIN_REWARD_RISK;
    }
  }
  const exitIdx = Math.min(candles.length - 1, entryIndex + maxHoldDays);
  if (exitIdx <= entryIndex) return null;
  const exitPrice = candles[exitIdx].close;
  return direction === 'short' ? (entry - exitPrice) / stopDistance : (exitPrice - entry) / stopDistance;
}

function summarizeR(rValues) {
  const n = rValues.length;
  if (!n) return { trades: 0, winRate: null, avgR: null, stoppedOutPercent: null, targetHitPercent: null };
  const wins = rValues.filter((r) => r > 0);
  const stoppedOut = rValues.filter((r) => r === -1).length;
  const targetHit = rValues.filter((r) => r === MIN_REWARD_RISK).length;
  return {
    trades: n,
    winRate: Math.round((wins.length / n) * 1000) / 10,
    avgR: Math.round((rValues.reduce((a, b) => a + b, 0) / n) * 1000) / 1000,
    stoppedOutPercent: Math.round((stoppedOut / n) * 1000) / 10,
    targetHitPercent: Math.round((targetHit / n) * 1000) / 10,
  };
}

async function runForUniverse(universeCandlesFn, universe, kinds, log = console.log) {
  const rByKind = {};
  let symbolsUsed = 0;
  for (const item of universe) {
    let candles;
    try {
      candles = await universeCandlesFn(item);
    } catch (err) {
      log(`[rMultipleBacktest] skip ${item}: ${err.message}`);
      continue;
    }
    if (!candles || candles.length < 100) continue;
    symbolsUsed += 1;
    const occurrences = walkForwardOccurrences(candles);
    for (const kind of kinds) {
      const hits = occurrences[kind] || [];
      for (const hit of hits) {
        const r = simulateRMultiple(candles, hit.index, hit.direction || 'long');
        if (r === null) continue;
        if (!rByKind[kind]) rByKind[kind] = [];
        rByKind[kind].push(r);
      }
    }
  }
  const summary = {};
  for (const kind of kinds) summary[kind] = summarizeR(rByKind[kind] || []);
  return { symbolsUsed, summary };
}

module.exports = { simulateRMultiple, summarizeR, runForUniverse };
