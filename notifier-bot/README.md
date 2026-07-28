# Quant Signal Bot

Telegram alert bot for short-swing (1-2 day hold) stock and crypto signals.
Built by reusing/porting the signal-detection logic from the Quant desktop
app (`purnamasari/quant`), validated with an aggregate multi-symbol backtest
instead of trusting each pattern type on faith.

Originally scoped to live in its own repository; GitHub App permissions in
this session couldn't create one (`403 Resource not accessible by
integration`), so it lives here instead, on the `notifier-bot` branch. To
split it out later:

```
git subtree split --prefix=notifier-bot -b notifier-bot-only
# push notifier-bot-only to a new repo
```

## Setup

```
cd notifier-bot
cp .env.example .env
# fill in TELEGRAM_BOT_TOKEN (from @BotFather) and TELEGRAM_CHAT_ID
node src/job.js
```

No `npm install` needed — everything uses Node's built-in `fetch` (Node
18+ required, tested on Node 22).

## What's in here

- `src/stock/` — Yahoo Finance chart + earnings fetch, ported signal
  detection (`src/shared/signals.ts` from the main Quant repo), aggregate
  universe backtest.
- `src/crypto/` — OKX kline + funding-rate fetch (see note below on why
  OKX, not Binance), same signal detection reused, its own backtest.
- `src/analysis/correlateSignals.js` — Jaccard co-occurrence check between
  the 11 stock signal kinds, to catch redundant/cherry-picked signals
  (see `data/stock-signal-validation.md`).
- `src/risk.js` — ATR-based entry/stop/target so alerts are directly
  actionable, not just "something happened."
- `src/job.js` — daily orchestration: scan stocks + crypto, filter to the
  validated signal kinds, flag (never silently skip) imminent earnings,
  send to Telegram.
- `data/stock-signal-validation.md`, `data/crypto-signal-validation.md` —
  the actual backtest + correlation numbers behind the default alert
  filters in `src/config.js`. Read these before trusting the defaults.

## Important limitations — read before relying on this

1. **Binance is unreachable from this environment.** Both
   `api.binance.com` and `fapi.binance.com` returned HTTP 451
   ("restricted location") when tested here; Bybit returned a CloudFront
   403. OKX and Kraken/Coinbase were reachable, so crypto data comes from
   OKX. If you self-host this somewhere with real Binance access, swap
   `src/crypto/okx.js` for a Binance client — the signal/backtest code
   above it doesn't need to change.
2. **Stock universe is small** (~90 large-cap US stocks/ETFs bundled in
   `data/symbol-directory.json`, copied from the Quant desktop app) — not
   the full US market. Set `STOCK_WATCHLIST` in `.env` to scan specific
   symbols instead.
3. **Backtests are historical, not a promise.** Stock validation covers 3
   years across 91 symbols; crypto covers 2 years across 10 pairs. Both
   periods were broadly rising markets — expectancy numbers likely carry
   some baseline drift, not pure pattern edge. Re-run
   `npm run backtest:stock` / a crypto equivalent periodically.
4. **`funding-extreme` (crypto) has no historical backtest.** It's a
   plausible heuristic (crowded positioning via extreme perpetual funding
   rate), not validated the way the price-pattern signals are.
5. **Crypto signal thresholds are the stock thresholds, unmodified.** The
   backtest in `data/crypto-signal-validation.md` checks whether that
   reuse holds up empirically (it mostly does, except golden-cross/
   cup-handle which flip negative) rather than hand-tuning new constants.
6. **This sends real Telegram messages when run.** `TELEGRAM_BOT_TOKEN`
   and `TELEGRAM_CHAT_ID` in `.env` are real credentials — never commit
   `.env` (it's gitignored) or paste the token anywhere public.

## Scheduling

See the parent conversation for how this got wired up to a daily Routine
in the Claude session that built it. If that session/environment goes
away, this needs to be scheduled some other way (cron on a VPS, GitHub
Actions, etc.) — nothing here depends on Claude Code to run once it's
scheduled and has valid credentials.
