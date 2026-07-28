// Crypto signal detection. Reuses the exact same pattern-detection math as
// stocks (src/stock/signals.js) — it's generic price/volume technical
// analysis, not literally stock-specific — rather than hand-guessing new
// threshold constants for crypto's higher volatility. The empirical
// backtest in this module's sibling script validates whether that reuse
// actually holds up on crypto data rather than assuming it does; see
// data/crypto-signal-validation.md for the result. On top of that, one
// crypto-only signal is added: extreme perpetual funding rate, which has
// no stock equivalent (closest analogue is short interest).
const { detectStockSignals } = require('../stock/signals');

const FUNDING_EXTREME_THRESHOLD = 0.0005; // 0.05% per 8h ~ over 3x typical BTC funding

function detectCryptoSignals(candles, fundingRate) {
  const { signals, metrics } = detectStockSignals(candles);
  if (fundingRate && Number.isFinite(fundingRate.fundingRate)) {
    const rate = fundingRate.fundingRate;
    if (Math.abs(rate) >= FUNDING_EXTREME_THRESHOLD) {
      signals.push({
        kind: 'funding-extreme',
        label: rate > 0 ? 'Funding extreme (long crowded)' : 'Funding extreme (short crowded)',
        score: 11,
        detail: `Perpetual funding rate is ${(rate * 100).toFixed(3)}% per 8h — crowded positioning, possible reversal risk.`,
        tone: rate > 0 ? 'watch' : 'bullish',
      });
    }
  }
  return { signals, metrics };
}

module.exports = { detectCryptoSignals, FUNDING_EXTREME_THRESHOLD };
