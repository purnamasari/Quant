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
  // Sprint 1 "satu mulut" (market-pulse/docs/IMPLEMENTATION-PLAN.md §3).
  // off = current behaviour (this bot sends directly, nothing posted to MP).
  // shadow = this bot keeps sending AND posts to MP with delivery_state
  //   'suppressed' (dual-run, MP never sends — see R5 in the plan).
  // live = this bot stops sending; MP's platform bot sends instead.
  // Default 'off' — the orchestrator flips this in a quiet window, not us.
  platformDelivery: process.env.PLATFORM_DELIVERY || 'off',
  platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL || 'http://localhost:8002',
  // Sprint 2 "balik arah" (market-pulse/docs/IMPLEMENTATION-PLAN.md §3 task 3).
  // '0' = no call at all (default); '1' = every recorded signal is mirrored to
  // MP's /api/v1/ingest/signal. Writing-only: nothing about this flag changes
  // what gets sent to Telegram, so a dual-run cannot double-notify (R5).
  platformSignals: process.env.PLATFORM_SIGNALS || '0',
  // Market Pulse's internal-key bridge (app/auth/dependencies.py) — same
  // shared secret as MP's own INTERNAL_API_KEY, and the MP user id every
  // ingested alert is attributed to.
  platformInternalApiKey: process.env.PLATFORM_INTERNAL_API_KEY || '',
  platformInternalUserId: process.env.PLATFORM_INTERNAL_USER_ID || '',
  // Telegram user IDs allowed to open the Mini App dashboard (comma-separated,
  // e.g. "1576755331,12345"). The dashboard verifies initData signatures, and
  // the owner check compares the signing user against THIS list. The legacy
  // fallback (TELEGRAM_CHAT_ID) only works in a private DM where the chat id
  // equals the user id — in a group deployment the group id never matches a
  // personal id, so every owner gets 401 until the allowlist is set.
  dashboardAllowedUserIds: (process.env.DASHBOARD_ALLOWED_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
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
  //
  // UPDATE 2026-07-31 — Binance re-validation (after the OKX -> Binance
  // USDⓈ-M swap). Three kinds are stable everywhere and stay unconditional:
  // ma-alignment +1.24%, near-52w-high +1.49%, volume-surge +1.73%
  // cost-adjusted, in both time halves and both cap tiers.
  // cup-forming and bos-bullish were briefly dropped (both looked negative
  // POOLED across regimes: cup-forming -0.24%, 0 occurrences in the most
  // recent 365 days; bos-bullish -0.47% in the recent half). The follow-up
  // regime-gated validation showed the pooled numbers were averaging over
  // opposite-signed regime cells rather than measuring no edge — so both are
  // back in the defaults, but fire only in the regimes where they hold up.
  // See regimeGates below for the per-kind evidence.
  alertCryptoKinds: csv(process.env.ALERT_CRYPTO_KINDS).length
    ? csv(process.env.ALERT_CRYPTO_KINDS)
    : ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming', 'bos-bullish'],
  // Regime gates for kinds that are NOT regime-agnostic (2026-07-31 Binance
  // validation): a kind listed here fires only when the live BTC regime is
  // in the allowed list. Empty/missing = always on.
  //   bos-bullish: sideways only  — GUARD-BACKED: the only regime where it
  //     clears the independence guards (t=2.65, 9 months); negative in bull
  //     AND bear (t=-2.56), so the gate excludes the harmful regimes.
  //   cup-forming: bear/sideways — EXPLORATORY, NOT validated: its best cell
  //     (bear, t=3.81) FAILS the independence guards (5 months, 42% of
  //     trades in one month), its pooled number is negative (-0.24% cost-adj),
  //     and the rare-tier variant fails the time-stability split (n=0 in the
  //     most recent 365 days). Shipped deliberately as a low-risk hypothesis
  //     to accumulate fresh evidence. See
  //     data/binance-revalidation-2026-07-31.md §4/§7 — do not quote this
  //     gate as "validated".
  regimeGates: {
    'cup-forming': ['bear', 'sideways'],
    'bos-bullish': ['sideways'],
  },
  // Quant sweep 2026-07-31 (Binance, cost 0.25%, stable both halves): tighter
  // thresholds raise expectancy meaningfully. See QUANT_TASKS.md §1-2.
  volumeSurgeRatio: Number(process.env.VOLUME_SURGE_RATIO || 2.5),   // base was 1.75 → 2.5: +1.74%→+2.87%
  nearHighPercent: Number(process.env.NEAR_HIGH_PERCENT || 2),       // base was 4 → 2: +1.49%→+2.36%
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
