// How often does BTC actually break structure, at each pivot lookback?
//
// The point is alert volume, not edge. detectBoS defaults to pivotLookup=1 (a
// 3-bar fractal), which is right for the per-symbol signal kind but far too
// twitchy for a market-regime notification: on 4H it marks every wiggle, and a
// regime alert that fires several times a day is noise wearing a structural
// costume. Pick the lookback from the measured firing rate, then say what was
// chosen and why.
//
// Also reports what price does after a break, purely so the alert can be framed
// honestly. This is NOT a trade signal and is not being validated as one — BTC
// structure is context for the whole book.

const fs = require('node:fs');
const path = require('node:path');
const { detectBoS } = require('../smc');
const { getCandles } = require('../crypto/okx');

const CACHE = path.join(__dirname, '..', '..', 'data', 'export-structure');
const LOOKBACKS = [1, 2, 3, 5, 8];

async function candlesFor(bar, count) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `BTC-${bar}.json`);
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* refetch */ }
  }
  const candles = await getCandles('BTC-USDT', bar, count, { pauseMs: 150 });
  if (candles.length > 100) fs.writeFileSync(file, JSON.stringify(candles));
  return candles;
}

// Walk forward: at each bar, only candles up to that bar are visible.
function scan(candles, lookback) {
  const events = [];
  const warm = lookback * 2 + 3;
  for (let i = warm; i < candles.length; i++) {
    const bos = detectBoS(candles.slice(0, i + 1), lookback);
    if (bos) events.push({ i, time: candles[i].time, kind: bos.kind, level: bos.level, close: candles[i].close });
  }
  return events;
}

function forward(candles, i, bars) {
  const j = Math.min(candles.length - 1, i + bars);
  if (j <= i) return null;
  return ((candles[j].close - candles[i].close) / candles[i].close) * 100;
}

function summarise(xs) {
  const v = xs.filter(Number.isFinite);
  if (v.length < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
  return { n: v.length, mean: m, t: m / (sd / Math.sqrt(v.length)) };
}

async function main() {
  for (const [bar, count, perDay, horizon] of [['1D', 730, 1, 14], ['4H', 1000, 6, 12]]) {
    const candles = await candlesFor(bar, count);
    const days = candles.length / perDay;
    console.log(`\n=== BTC ${bar} — ${candles.length} candles ≈ ${Math.round(days)} days ===`);
    console.log('lookback  events  per month   bullish  bearish   fwd% after (t)');
    for (const lb of LOOKBACKS) {
      const ev = scan(candles, lb);
      const perMonth = (ev.length / days) * 30;
      const bull = ev.filter((e) => e.kind === 'bos-bullish');
      const bear = ev.filter((e) => e.kind === 'bos-bearish');
      const fBull = summarise(bull.map((e) => forward(candles, e.i, horizon)));
      const fBear = summarise(bear.map((e) => forward(candles, e.i, horizon)));
      console.log(
        `${String(lb).padStart(6)}  ${String(ev.length).padStart(6)}  ${perMonth.toFixed(1).padStart(9)}   ` +
        `${String(bull.length).padStart(7)}  ${String(bear.length).padStart(7)}   ` +
        `${fBull ? `bull ${fBull.mean.toFixed(2)}% (t ${fBull.t.toFixed(1)})` : 'bull —'}  ` +
        `${fBear ? `bear ${fBear.mean.toFixed(2)}% (t ${fBear.t.toFixed(1)})` : 'bear —'}`,
      );
    }
  }
  console.log('\nfwd% is the move over the next ' + '14 bars (1D) / 12 bars (4H), for framing only.');
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { main, scan };
