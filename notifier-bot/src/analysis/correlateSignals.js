// Fase 1: are the 11 signal kinds actually independent evidence, or mostly
// redundant re-descriptions of the same uptrend? Measured via Jaccard
// similarity of "fired on day X" sets, per symbol, averaged across the
// universe. High Jaccard (close to 1) between two kinds means they almost
// always fire on the same days — i.e. citing both as separate "evidence"
// is close to cherry-picking/double counting, the exact warning from the
// arXiv:2504.10914 paper discussed earlier.

const { getUniverse } = require('../stock/universe');
const { getChart } = require('../stock/yahoo');
const { walkForwardOccurrences } = require('../stock/backtest');

function jaccard(setA, setB) {
  if (!setA.size || !setB.size) return null;
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? null : intersection / union;
}

async function run({ range = '3y', symbols = null, log = console.log } = {}) {
  const universe = symbols || getUniverse();
  const pairSums = {}; // "kindA|kindB" -> { sum, n }
  let symbolsUsed = 0;

  for (const entry of universe) {
    const symbol = entry.symbol;
    let candles;
    try {
      const chart = await getChart(symbol, range, '1d');
      candles = chart.candles;
    } catch (err) {
      log(`[correlate] skip ${symbol}: ${err.message}`);
      continue;
    }
    if (candles.length < 100) continue;
    symbolsUsed += 1;

    const occurrences = walkForwardOccurrences(candles);
    const kinds = Object.keys(occurrences);
    const sets = {};
    for (const k of kinds) sets[k] = new Set(occurrences[k].map((h) => h.index));

    for (let i = 0; i < kinds.length; i++) {
      for (let j = i + 1; j < kinds.length; j++) {
        const a = kinds[i];
        const b = kinds[j];
        const key = [a, b].sort().join('|');
        const j2 = jaccard(sets[a], sets[b]);
        if (j2 === null) continue;
        if (!pairSums[key]) pairSums[key] = { sum: 0, n: 0 };
        pairSums[key].sum += j2;
        pairSums[key].n += 1;
      }
    }
  }

  const rows = Object.entries(pairSums)
    .map(([key, { sum, n }]) => ({ pair: key, avgJaccard: Math.round((sum / n) * 1000) / 1000, symbols: n }))
    .filter((r) => r.symbols >= 5)
    .sort((a, b) => b.avgJaccard - a.avgJaccard);

  return { symbolsUsed, rows };
}

if (require.main === module) {
  run().then(({ symbolsUsed, rows }) => {
    console.log(`\nSignal co-occurrence (Jaccard) across ${symbolsUsed} symbols — higher = more redundant\n`);
    for (const r of rows) {
      console.log(`${r.pair.padEnd(34)} avgJaccard=${r.avgJaccard}  (n symbols=${r.symbols})`);
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run, jaccard };
