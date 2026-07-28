const config = require('../config');

// Top-liquidity pairs used for the backtest validation & default scan.
// Expand via CRYPTO_WATCHLIST in .env.
const DEFAULT_VALIDATION_UNIVERSE = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'BNB-USDT', 'XRP-USDT',
  'DOGE-USDT', 'ADA-USDT', 'AVAX-USDT', 'LINK-USDT', 'LTC-USDT',
  'ZEC-USDT', 'HYPE-USDT',
];

function getUniverse() {
  return config.cryptoWatchlist.length ? config.cryptoWatchlist : DEFAULT_VALIDATION_UNIVERSE;
}

module.exports = { getUniverse, DEFAULT_VALIDATION_UNIVERSE };
