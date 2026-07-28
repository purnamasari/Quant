const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

function loadDirectory() {
  const filePath = path.join(__dirname, '..', '..', 'data', 'symbol-directory.json');
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(raw.symbols) ? raw.symbols : [];
}

// Bundled directory is a small curated set (~90 large-cap US stocks/ETFs),
// copied from purnamasari/quant `src/main/data/symbol-directory.json` — NOT
// the full US market. Good enough for a personal watchlist-style scan; not
// a substitute for the desktop app's broader signal-scanner universe.
function getUniverse() {
  if (config.stockWatchlist.length) {
    return config.stockWatchlist.map((symbol) => ({ symbol, name: symbol, type: 'stock' }));
  }
  return loadDirectory();
}

module.exports = { getUniverse };
