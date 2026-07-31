// 4H bias -> 15m zone -> 5m entry cascade backtest (crypto only, BTC
// first). Reuses the already-validated src/smc.js detectors (detectBoS,
// detectOB, detectFVG) unchanged, just run on different timeframes.
//
// Timestamp discipline (learned the hard way from the earlier bug): every
// OKX candle's `time` is its OPEN. A candle is only "known" once it
// CLOSES, at `time + intervalSeconds`. Every cross-timeframe lookup below
// compares against close time, never open time, so a lower-timeframe bar
// can never see a higher-timeframe event before that event actually
// finished forming.
//
// Pipeline:
//  1. 4H bias: walk forward over 4H candles, track a running bias that
//     flips whenever detectBoS fires (bullish -> 'long', bearish ->
//     'short'), each stamped with the confirming candle's CLOSE time.
//  2. 15m zone: walk forward over 15m candles; whenever detectOB/detectFVG
//     fires bullish AND the 4H bias (as of that 15m candle's close) is
//     'long', record an unmitigated support zone [bottom, top].
//  3. 5m entry: walk forward over 5m candles; for each unmitigated zone
//     already known (zone formed-at <= this 5m candle's open time) whose
//     price range this candle touches (candle.low <= zone.top), trigger:
//       - Rule A: this same candle already closes bullish (close > open)
//         -> entry now. Otherwise wait for the next bullish-closing candle.
//       - Rule B: same as A but additionally require a fresh 5m
//         detectBoS('long') at or after the touch.
//     A zone is consumed (removed from "active") once it produces an
//     entry or once HOLD_5M_BARS worth of time has passed since it formed
//     without ever being touched (stale, dropped).

const { getCandles } = require('../crypto/binance');
const { detectOB, detectFVG, detectBoS } = require('../smc');

const H4_SECONDS = 4 * 3600;
const M15_SECONDS = 15 * 60;
const M5_SECONDS = 5 * 60;
const HOLD_5M_BARS = 576; // ~2 days of 5m bars, matches the bot's usual hold
const ZONE_STALE_SECONDS = 5 * 86400; // drop an unmitigated zone if untouched after 5 days

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

function buildBiasTimeline(candles4h, minHistory = 20) {
  const timeline = []; // { closeTime, bias }
  let bias = null;
  for (let i = minHistory; i < candles4h.length; i++) {
    const window = candles4h.slice(0, i + 1);
    const bos = detectBoS(window);
    if (bos) bias = bos.direction; // 'long' or 'short'
    timeline.push({ closeTime: candles4h[i].time + H4_SECONDS, bias });
  }
  return timeline;
}

function biasAsOf(timeline, t) {
  let result = null;
  for (const entry of timeline) {
    if (entry.closeTime > t) break;
    result = entry.bias;
  }
  return result;
}

function buildZones(candles15m, biasTimeline, minHistory = 10) {
  const zones = [];
  for (let j = minHistory; j < candles15m.length; j++) {
    const window = candles15m.slice(0, j + 1);
    const closeTime = candles15m[j].time + M15_SECONDS;
    const bias = biasAsOf(biasTimeline, closeTime);
    if (bias !== 'long') continue;
    const ob = detectOB(window);
    if (ob && ob.direction === 'long') {
      zones.push({ top: ob.top, bottom: ob.bottom, formedAt: closeTime, source: 'ob' });
    }
    const fvg = detectFVG(window);
    if (fvg && fvg.direction === 'long') {
      zones.push({ top: fvg.top, bottom: fvg.bottom, formedAt: closeTime, source: 'fvg' });
    }
  }
  return zones;
}

function runEntrySim(candles5m, zones, rule) {
  const returns = [];
  const active = zones.map((z) => ({ ...z, used: false }));
  for (let k = 0; k < candles5m.length; k++) {
    const candle = candles5m[k];
    for (const zone of active) {
      if (zone.used) continue;
      if (candle.time < zone.formedAt) continue; // zone not known yet
      if (candle.time - zone.formedAt > ZONE_STALE_SECONDS) {
        zone.used = true; // drop stale, never touched
        continue;
      }
      const touched = candle.low <= zone.top && candle.high >= zone.bottom;
      if (!touched) continue;

      const closesBullish = candle.close > candle.open;
      let triggered = closesBullish;
      if (triggered && rule === 'B') {
        const bos = detectBoS(candles5m.slice(0, k + 1));
        triggered = Boolean(bos && bos.direction === 'long');
      }
      if (!triggered) continue;

      const exitIdx = Math.min(candles5m.length - 1, k + HOLD_5M_BARS);
      if (exitIdx > k) {
        const entryPrice = candle.close;
        const exitPrice = candles5m[exitIdx].close;
        if (entryPrice > 0) returns.push(((exitPrice - entryPrice) / entryPrice) * 100);
      }
      zone.used = true;
    }
  }
  return returns;
}

async function run({ symbol = 'BTC-USDT', days4h = 200, days15m = 90, days5m = 90, log = console.log } = {}) {
  const candles4h = await getCandles(symbol, '4H', days4h * 6, { pauseMs: 150 });
  log(`[cryptoMultiTimeframe] ${symbol}: 4H bars=${candles4h.length}`);
  const candles15m = await getCandles(symbol, '15m', days15m * 96, { pauseMs: 150 });
  log(`[cryptoMultiTimeframe] ${symbol}: 15m bars=${candles15m.length}`);
  const candles5m = await getCandles(symbol, '5m', days5m * 288, { pauseMs: 150 });
  log(`[cryptoMultiTimeframe] ${symbol}: 5m bars=${candles5m.length}`);

  const biasTimeline = buildBiasTimeline(candles4h);
  const zones = buildZones(candles15m, biasTimeline);
  log(`[cryptoMultiTimeframe] ${symbol}: ${zones.length} bullish 15m zones found within 4H bullish bias`);

  const returnsA = runEntrySim(candles5m, zones, 'A');
  const returnsB = runEntrySim(candles5m, zones, 'B');

  return {
    zonesFound: zones.length,
    ruleA: summarize(returnsA),
    ruleB: summarize(returnsB),
  };
}

if (require.main === module) {
  const symbol = process.argv[2] || 'BTC-USDT';
  run({ symbol }).then((result) => {
    console.log(`\n4H-15m-5m cascade — ${symbol}\n`);
    console.log('zones found:', result.zonesFound);
    console.log('Rule A (immediate bullish close on touch):', JSON.stringify(result.ruleA));
    console.log('Rule B (touch + mini-BoS confirmation):    ', JSON.stringify(result.ruleB));
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run, buildBiasTimeline, buildZones, runEntrySim };
