const fs = require('node:fs');
const path = require('node:path');

// Minimal .env loader (no external dependency). Real secrets never get
// committed: .env is gitignored, only .env.example ships in git.
function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

function csv(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  stockWatchlist: csv(process.env.STOCK_WATCHLIST),
  // Empty when unset — crypto/universe.js supplies its own (larger) default
  // validation universe rather than duplicating a fallback list here.
  cryptoWatchlist: csv(process.env.CRYPTO_WATCHLIST),
  holdDays: Number(process.env.HOLD_DAYS || 2),
  // Data-driven default from data/stock-signal-validation.md (3y universe
  // backtest + Jaccard redundancy check): these are the least-correlated
  // AND highest-expectancy signal kinds. Override in .env if you disagree
  // after reviewing that table yourself — don't treat this as gospel.
  // Updated after the 10y/full-cycle + cost-sensitivity + stability re-test
  // (see data/stock-signal-validation.md "Improvement pass"). The original
  // 3y-only picks (mean-reversion, volume-surge, cup-handle) flipped sign
  // between 2016-2021 and 2021-2026 and went negative once a 0.15%
  // round-trip cost was assumed — they were riding the recent bull run, not
  // a real edge. momentum/cup-forming/golden-cross were the only kinds
  // that stayed positive across both halves AND after cost.
  alertStockKinds: csv(process.env.ALERT_STOCK_KINDS).length
    ? csv(process.env.ALERT_STOCK_KINDS)
    : ['momentum', 'cup-forming', 'golden-cross'],
  // Deliberately different from stock defaults — see
  // data/crypto-signal-validation.md: golden-cross/cup-handle back-tested
  // negative on crypto even though they were among the best on stocks.
  // Re-checked with a 0.25% round-trip cost assumption in the improvement
  // pass — all four stay comfortably positive (0.44%-0.91%), unlike the
  // original stock picks which didn't survive their own cost check.
  alertCryptoKinds: csv(process.env.ALERT_CRYPTO_KINDS).length
    ? csv(process.env.ALERT_CRYPTO_KINDS)
    : ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming'],
  earningsGuardDays: Number(process.env.EARNINGS_GUARD_DAYS || 3),
};
