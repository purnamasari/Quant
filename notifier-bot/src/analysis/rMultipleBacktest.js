// Proper R-multiple backtest for the signals currently in
// config.alertStockKinds / alertCryptoKinds — instead of raw % return
// (what data/*-signal-validation.md reports), this simulates the actual
// stop/target defined by risk.js's riskPlanFor (ATR*1.5 stop, configurable
// R:R target) day-by-day over the hold window, same as the trade a live
// alert would actually propose. Parameterized (holdDays, minimumRewardRisk)
// to test whether a longer hold or a tighter target gets closer to a
// 0.5-1R average expectancy than the default 2-day/1.8R combo (which
// landed at only 0.05-0.12R — see git history for that first pass).

const { walkForwardOccurrences } = require('../stock/backtest');
const { atr } = require('../risk');

const ATR_STOP_MULTIPLIER = 1.5;

function simulateRMultiple(candles, entryIndex, direction, maxHoldDays = 2, minimumRewardRisk = 1.8) {
  const entry = candles[entryIndex].close;
  const a = atr(candles.slice(0, entryIndex + 1), 14) ?? entry * 0.02;
  if (!(a > 0)) return null;
  const stopDistance = a * ATR_STOP_MULTIPLIER;
  const stop = direction === 'short' ? entry + stopDistance : entry - stopDistance;
  const target = direction === 'short' ? entry - stopDistance * minimumRewardRisk : entry + stopDistance * minimumRewardRisk;

  for (let d = 1; d <= maxHoldDays; d++) {
    const idx = entryIndex + d;
    if (idx >= candles.length) break;
    const bar = candles[idx];
    if (direction === 'short') {
      if (bar.high >= stop) return -1;
      if (bar.low <= target) return minimumRewardRisk;
    } else {
      if (bar.low <= stop) return -1;
      if (bar.high >= target) return minimumRewardRisk;
    }
  }
  const exitIdx = Math.min(candles.length - 1, entryIndex + maxHoldDays);
  if (exitIdx <= entryIndex) return null;
  const exitPrice = candles[exitIdx].close;
  return direction === 'short' ? (entry - exitPrice) / stopDistance : (exitPrice - entry) / stopDistance;
}

function summarizeR(rValues, targetR = 1.8) {
  const n = rValues.length;
  if (!n) return { trades: 0, winRate: null, avgR: null, stoppedOutPercent: null, targetHitPercent: null };
  const wins = rValues.filter((r) => r > 0);
  const stoppedOut = rValues.filter((r) => r === -1).length;
  const targetHit = rValues.filter((r) => r === targetR).length;
  return {
    trades: n,
    winRate: Math.round((wins.length / n) * 1000) / 10,
    avgR: Math.round((rValues.reduce((a, b) => a + b, 0) / n) * 1000) / 1000,
    stoppedOutPercent: Math.round((stoppedOut / n) * 1000) / 10,
    targetHitPercent: Math.round((targetHit / n) * 1000) / 10,
  };
}

async function runForUniverse(universeCandlesFn, universe, kinds, { holdDays = 2, minimumRewardRisk = 1.8, requireConfluence = 1, log = console.log } = {}) {
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

    // confluence: count how many of the target `kinds` fire on the same day
    const dayCounts = new Map();
    for (const kind of kinds) {
      for (const hit of occurrences[kind] || []) {
        if (!dayCounts.has(hit.index)) dayCounts.set(hit.index, { count: 0, direction: hit.direction || 'long' });
        dayCounts.get(hit.index).count += 1;
      }
    }

    for (const kind of kinds) {
      const hits = occurrences[kind] || [];
      for (const hit of hits) {
        if (requireConfluence > 1 && (dayCounts.get(hit.index)?.count || 0) < requireConfluence) continue;
        const r = simulateRMultiple(candles, hit.index, hit.direction || 'long', holdDays, minimumRewardRisk);
        if (r === null) continue;
        if (!rByKind[kind]) rByKind[kind] = [];
        rByKind[kind].push(r);
      }
    }
  }
  const summary = {};
  for (const kind of kinds) summary[kind] = summarizeR(rByKind[kind] || [], minimumRewardRisk);
  return { symbolsUsed, summary };
}

module.exports = { simulateRMultiple, summarizeR, runForUniverse };
