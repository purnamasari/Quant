const config = require('../config');

// Pairs actually scanned. Set by the user; expand via CRYPTO_WATCHLIST in .env.
const DEFAULT_SCAN_UNIVERSE = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT', 'ZEC-USDT', 'HYPE-USDT',
  'DOGE-USDT', 'BNB-USDT', 'ADA-USDT', 'NEAR-USDT', 'AAVE-USDT', 'ONDO-USDT',
];

// Scanning a pair and trusting the rare high-conviction tier on it are two
// different claims. The tier's 0.497R / 67.8% number was measured on a
// specific 12-pair universe (see data/crypto-signal-validation.md); NEAR,
// AAVE and ONDO were never part of it, and in the per-symbol check AAVE and
// ONDO came out negative (-1.0R each, though on only n=2). They still get
// normal alerts — they just don't get the VERY HIGH badge until they have
// evidence behind them. Everything else in the scan list was in the
// validated set.
const RARE_TIER_UNIVERSE = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT', 'ZEC-USDT', 'HYPE-USDT',
  'DOGE-USDT', 'BNB-USDT', 'ADA-USDT',
];

// The original 12 the backtests in data/crypto-signal-validation.md ran on.
// Kept so those numbers stay reproducible after the scan list changed.
const DEFAULT_VALIDATION_UNIVERSE = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'BNB-USDT', 'XRP-USDT',
  'DOGE-USDT', 'ADA-USDT', 'AVAX-USDT', 'LINK-USDT', 'LTC-USDT',
  'ZEC-USDT', 'HYPE-USDT',
];

function getUniverse() {
  return config.cryptoWatchlist.length ? config.cryptoWatchlist : DEFAULT_SCAN_UNIVERSE;
}

module.exports = { getUniverse, DEFAULT_SCAN_UNIVERSE, RARE_TIER_UNIVERSE, DEFAULT_VALIDATION_UNIVERSE };
