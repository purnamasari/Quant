// Perpetual funding cost measured in R units — the missing piece for holding
// a leveraged position 7 days.
//
// Why R units: funding is charged on NOTIONAL, and 1R of our strategy is also
// a fixed % of notional (the ATR*1.5 stop distance). So
//     funding cost in R = (cumulative funding % over the hold) / stopPct
// and this ratio is INDEPENDENT of leverage — leverage scales both the cost
// and the payoff identically. That makes it directly comparable to the
// strategy's 0.497R edge: if a 7-day funding bill runs to 0.5R, the entire
// edge is gone regardless of how much or how little leverage is used.
//
// Note the asymmetry this creates: BTC has the TIGHTEST stop (~3.9% at
// signal) which is what allows the highest leverage — but that same tight
// stop makes it the MOST vulnerable to funding drag in R terms, because the
// same funding % is divided by a smaller number.
//
// This also fills the gap flagged in data/crypto-signal-validation.md:
// "funding-extreme has no historical backtest at all".

const { DEFAULT_VALIDATION_UNIVERSE } = require('../crypto/universe');

const BASE = 'https://www.okx.com';
const HOLD_DAYS = 7;
const FUNDINGS_PER_DAY = 3; // OKX settles every 8h
const HOLD_PERIODS = HOLD_DAYS * FUNDINGS_PER_DAY;

// Median ATR*1.5 stop width at signal time, measured by leverageRisk.js.
// Used to convert a funding % into R for each pair.
const STOP_PCT_AT_SIGNAL = {
  'BTC-USDT': 3.88, 'ETH-USDT': 8.83, 'SOL-USDT': 9.57, 'BNB-USDT': 7.88,
  'XRP-USDT': 13.41, 'DOGE-USDT': 10.19, 'ADA-USDT': 8.71, 'AVAX-USDT': 9.7,
  'LINK-USDT': 12.42, 'LTC-USDT': 8.57,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchFundingHistory(symbol, maxRecords = 2200) {
  const instId = `${symbol.replace('-USDT', '')}-USDT-SWAP`;
  const rows = [];
  let before;
  while (rows.length < maxRecords) {
    const url = new URL(`${BASE}/api/v5/public/funding-rate-history`);
    url.searchParams.set('instId', instId);
    url.searchParams.set('limit', '100');
    if (before) url.searchParams.set('after', before);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== '0') throw new Error(json.msg || 'okx error');
    const data = json.data || [];
    if (!data.length) break;
    for (const row of data) {
      rows.push({ time: Number(row.fundingTime), rate: Number(row.realizedRate ?? row.fundingRate) });
    }
    before = data[data.length - 1].fundingTime;
    if (data.length < 100) break;
    await sleep(120);
  }
  rows.sort((a, b) => a.time - b.time);
  return rows;
}

// Rolling sum of the next HOLD_PERIODS funding payments — i.e. what a long
// opened at time t actually pays over a 7-day hold.
function rollingHoldCost(rows) {
  const costs = [];
  for (let i = 0; i + HOLD_PERIODS <= rows.length; i++) {
    let sum = 0;
    for (let j = i; j < i + HOLD_PERIODS; j++) sum += rows[j].rate;
    costs.push({ time: rows[i].time, costPct: sum * 100 });
  }
  return costs;
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

async function run({ log = console.log } = {}) {
  const results = {};
  for (const symbol of DEFAULT_VALIDATION_UNIVERSE) {
    try {
      const rows = await fetchFundingHistory(symbol);
      if (rows.length < HOLD_PERIODS + 10) {
        log(`[fundingCost] ${symbol}: only ${rows.length} records, skipping`);
        continue;
      }
      const costs = rollingHoldCost(rows);
      const sortedPct = costs.map((c) => c.costPct).sort((a, b) => a - b);
      const stopPct = STOP_PCT_AT_SIGNAL[symbol];
      results[symbol] = {
        records: rows.length,
        stopPct,
        p50Pct: quantile(sortedPct, 0.5),
        p90Pct: quantile(sortedPct, 0.9),
        p99Pct: quantile(sortedPct, 0.99),
        maxPct: sortedPct[sortedPct.length - 1],
        // share of history where a 7-day long would have paid enough funding
        // to eat more than a quarter / half of the 0.497R edge
        shareOver025R: stopPct ? sortedPct.filter((c) => c / stopPct > 0.125).length / sortedPct.length : null,
        shareOver05R: stopPct ? sortedPct.filter((c) => c / stopPct > 0.25).length / sortedPct.length : null,
      };
      log(`[fundingCost] ${symbol}: ${rows.length} funding records`);
    } catch (err) {
      log(`[fundingCost] skip ${symbol}: ${err.message}`);
    }
  }
  return results;
}

if (require.main === module) {
  run().then((results) => {
    console.log(`\n=== 7-day cumulative funding cost for a LONG (${HOLD_PERIODS} settlements) ===`);
    console.log(`R conversion uses each pair's median stop width at signal time.`);
    console.log(`Strategy edge for comparison: 0.497R\n`);
    console.log(
      'pair'.padEnd(11), 'stop%'.padStart(6), 'p50 %'.padStart(7), 'p90 %'.padStart(7),
      'p99 %'.padStart(7), 'max %'.padStart(7), 'p50 R'.padStart(7), 'p99 R'.padStart(7), 'max R'.padStart(7),
    );
    for (const [symbol, r] of Object.entries(results)) {
      const toR = (v) => (r.stopPct ? (v / r.stopPct).toFixed(3) : '-');
      console.log(
        symbol.padEnd(11),
        String(r.stopPct ?? '-').padStart(6),
        r.p50Pct.toFixed(3).padStart(7),
        r.p90Pct.toFixed(3).padStart(7),
        r.p99Pct.toFixed(3).padStart(7),
        r.maxPct.toFixed(3).padStart(7),
        toR(r.p50Pct).padStart(7),
        toR(r.p99Pct).padStart(7),
        toR(r.maxPct).padStart(7),
      );
    }
    console.log(`\n=== How often funding meaningfully erodes the edge ===`);
    for (const [symbol, r] of Object.entries(results)) {
      if (r.shareOver025R === null) continue;
      console.log(
        `${symbol.padEnd(11)} cost > 0.125R: ${(r.shareOver025R * 100).toFixed(1)}% of history   ` +
        `cost > 0.25R: ${(r.shareOver05R * 100).toFixed(1)}%`,
      );
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run, fetchFundingHistory, rollingHoldCost };
