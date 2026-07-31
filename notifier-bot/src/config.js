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
  telegramThreadId: process.env.TELEGRAM_THREAD_ID || '',
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
  // ob-bullish (Order Block, ported from a TradingView SMC indicator, see
  // src/smc.js) added after it beat momentum/cup-forming/golden-cross on
  // every test: stable across both 5y halves, stays positive after cost in
  // BOTH halves (0.11%/0.02%, where others go flat-to-negative), and low
  // redundancy (<0.1 Jaccard) with the existing three.
  //
  // DISABLED as of the confluence test (src/analysis/stockConfluenceTest.js,
  // results in data/stock-signal-validation.md). Every comment above measures
  // these kinds against ZERO, which is the wrong benchmark: US stocks rose over
  // the test window, so any 14-day long looks profitable. Against a
  // random-entry control on the same symbols and window they are
  // indistinguishable — 0.191R signal vs 0.203R random (t -0.45). Requiring
  // confluence, the thing that made crypto cup-forming work, made stocks
  // slightly worse (0.172R, t -1.10 vs random) and its own halves decayed
  // 0.251R -> 0.094R.
  //
  // The live symptom was 59 stock alerts with charts in one scheduled run,
  // burying the rare crypto tier that fires every 6-10 days at 0.949R. Sending
  // dice rolls at that volume trains you to ignore the bot.
  //
  // Set ALERT_STOCK_KINDS in .env to re-enable (the detectors and backtests all
  // still work) — but re-run stockConfluenceTest.js against random first.
  alertStockKinds: csv(process.env.ALERT_STOCK_KINDS),
  // Deliberately different from stock defaults — see
  // data/crypto-signal-validation.md: golden-cross/cup-handle back-tested
  // negative on crypto even though they were among the best on stocks.
  // Re-checked with a 0.25% round-trip cost assumption in the improvement
  // pass — all four stay comfortably positive (0.44%-0.91%), unlike the
  // original stock picks which didn't survive their own cost check.
  // bos-bullish (Break of Structure, same src/smc.js port) added for
  // crypto after cost-adjusted backtest (0.52%, n=464) and low redundancy
  // (<0.15 Jaccard) with the other four. NOTE: ob-bullish — the best
  // performer on stocks — tested NEGATIVE on crypto (-0.64%), so it's
  // deliberately NOT added here. Another reminder these don't transfer
  // across asset classes.
  alertCryptoKinds: csv(process.env.ALERT_CRYPTO_KINDS).length
    ? csv(process.env.ALERT_CRYPTO_KINDS)
    : ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming', 'bos-bullish'],
  earningsGuardDays: Number(process.env.EARNINGS_GUARD_DAYS || 3),
  // Leveraged position sizing (see src/positionSizing.js). ACCOUNT_SIZE is
  // optional — without it alerts still show max safe leverage and the
  // notional-per-unit-of-risk ratio, just not concrete amounts. RISK_PERCENT
  // is the share of the account risked if the stop is hit; 1% is the
  // conventional ceiling and already aggressive when several correlated
  // crypto longs can be open at once.
  accountSize: Number(process.env.ACCOUNT_SIZE || 0),
  riskPercent: Number(process.env.RISK_PERCENT || 1),
  // Crypto longs are all substantially the same bet on BTC direction
  // (correlation typically 0.7-0.9), so N open positions is closer to N x
  // risk than to a diversified book. Caps total simultaneous exposure.
  maxConcurrentPositions: Number(process.env.MAX_CONCURRENT_POSITIONS || 3),
};
