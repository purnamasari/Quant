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

Run `npm install` once (adds `playwright`, used only for chart rendering —
everything else uses Node's built-in `fetch`, Node 18+ required, tested on
Node 22). Playwright needs a Chromium binary; this was built against the
one pre-installed at `/opt/pw-browsers` in the Claude Code environment
(`src/chart.js` auto-detects it). Self-hosting elsewhere: either keep that
same layout or run `npx playwright install chromium` once.

## Long AND short, with a caveat

Every signal kind now carries a `direction: 'long' | 'short'`. Bearish
mirror signals (death-cross, macd-bearish, volume-surge-down,
momentum-laggard, mean-reversion-short, near/new-52w-low, rebound-down,
distribution) were added and backtested the same way as the long ones —
**but none of them cleared a meaningful expectancy bar** (see the "Bearish
mirror signals" section in both `data/*-signal-validation.md` files), so
none are in the default `alertStockKinds`/`alertCryptoKinds` filters. The
code fully supports enabling them (just add the kind to `ALERT_STOCK_KINDS`
/ `ALERT_CRYPTO_KINDS` in `.env`), but the data doesn't back it right now —
likely because the backtest window was a broadly rising market. Re-test
after a real down/choppy stretch before trusting a short signal.

## H-1 reminders + news context

Every day, before the signal alerts, the bot sends one reminder message
covering **tomorrow**:
- Major US macro releases (CPI, PCE, NFP, FOMC, GDP, etc.) via Nasdaq's
  public economic-calendar API (`src/macro.js`)
- Earnings across the **whole** stock watchlist, not just symbols with an
  active signal (`scanEarningsTomorrow` in `src/job.js`)
- Token unlocks you've noted yourself in `data/token-unlocks.json` — see
  that file's header comment for why this isn't a live feed

Each signal alert also carries 1-2 recent news headlines (`src/news.js`):
Yahoo Finance RSS per stock symbol, Google News RSS search by coin name
for crypto.

## Conviction rating

Every alert shows a conviction tier (⭐⭐⭐ VERY HIGH / ⭐⭐ HIGH / ⭐ MEDIUM /
▫️ LOW) plus a one-line reason. This is a static lookup
(`data/signal-conviction.json`), hand-derived from the actual backtest
numbers in the improvement pass — cost-adjusted expectancy, stability
across the two 5-year halves, and sample size — not recomputed live on
every run (that would mean re-running the full backtest daily, which takes
tens of seconds to minutes). Nothing currently qualifies as VERY HIGH,
which is intentional: none of the signals cleared that bar honestly. If
you re-run the backtest scripts and the picture changes, update this file
by hand.

## Timezones and macro pings

Every UTC time shown (macro events, run timestamps) also shows the WIB
(UTC+7, no DST) equivalent — see `src/time.js`. Beyond the daily "what's
happening tomorrow" digest, a **second, separate Routine runs hourly**
(`src/macroPing.js`) and sends a one-off "~1 hour away" ping for any major
macro release landing in the next ~70 minutes, tracked in
`data/.macro-ping-state.json` so it doesn't repeat. Most hourly checks
find nothing to send, which is expected.

Each ping also includes a scenario explanation (`src/macroImpact.js`,
data in `data/macro-event-impact.json`): what a higher-than-consensus vs
lower-than-consensus print typically means for stocks and crypto,
per event category (CPI/PCE/PPI, NFP/jobless claims, FOMC, GDP, ISM,
retail sales, consumer confidence). This is a simplified textbook
heuristic, not a forecast — jobs/growth data in particular is genuinely
two-sided (a strong number can be bullish "soft landing" or bearish
"Fed won't cut" depending on which narrative the market is in that week),
and every entry says so explicitly rather than pretending otherwise.

## Charts

Each alert is preceded by a candlestick chart (last 60 daily candles) with
entry/stop/target levels drawn on it, sent as a Telegram photo followed by
the full text alert. Rendered via Playwright + the pre-installed Chromium
using a plain `<canvas>` drawing (`src/chart.js`) — no chart-library
dependency, no network calls from inside the rendered page. One browser
instance is reused across all of a run's charts rather than launching per
image (still adds real time to the job — expect it to take noticeably
longer than the no-chart version, since each render is a full headless
page load + screenshot).

## FOLLOW / SKIP tracking — delayed, not real-time

Each alert message carries two inline buttons. Tapping one is meant to
record whether you actually took the trade, logged to
`data/alert-log.json` (id, symbol, kind, direction, conviction, sentAt,
decision, decidedAt).

**Read this before expecting real-time behavior:** the bot is a daily
(and hourly, for macro pings) cron job, not a running server. There's no
webhook or long-poll listener sitting there waiting for your tap. Telegram
queues button presses (`callback_query` updates) server-side regardless,
so nothing is lost — but they're only picked up and logged the **next
time `job.js` runs**, via `processPendingCallbacks()` in `src/tracking.js`
calling `getUpdates()` once at the start of each run. That means a button
you tap today shows up in the log (and stops showing a loading spinner in
Telegram) up to ~24h later, not instantly. If you need real-time tracking,
this architecture (scheduled Routine, no persistent process) can't give
you that — it would need an actual always-on server with a webhook.

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
- `src/job.js` — daily orchestration: send H-1 reminder, scan stocks +
  crypto, filter to the validated signal kinds, flag (never silently skip)
  imminent earnings, send to Telegram.
- `src/macro.js` — tomorrow's major US macro events (Nasdaq calendar API).
- `src/news.js` — news headlines per stock/crypto for alert context.
- `src/tokenUnlocks.js` — reads `data/token-unlocks.json` (user-maintained,
  no live API found for this — see file header).
- `src/conviction.js` — looks up `data/signal-conviction.json` per signal kind.
- `src/time.js` — UTC → WIB conversion helpers.
- `src/macroPing.js` — hourly "macro event ~1h away" check, run by a
  separate Routine from the daily `job.js`.
- `src/macroImpact.js` — looks up `data/macro-event-impact.json` for the
  higher/lower-than-consensus scenario explanation attached to each ping.
- `src/chart.js` — Playwright-based candlestick chart renderer.
- `src/tracking.js` — FOLLOW/SKIP button logging (delayed, see above).
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

Two separate Routines were set up in the Claude session that built this:
one daily (`node src/job.js`, the signal scan + H-1 digest) and one
hourly (`node src/macroPing.js`, the ~1h-before macro ping). If that
session/environment goes away, both need to be scheduled some other way
(cron on a VPS, GitHub Actions, etc.) — nothing here depends on Claude
Code to run once scheduled with valid credentials. Genuinely uncertain
whether this environment's filesystem (including `.env`, which is
deliberately not in git) survives being reclaimed after idling and then
resumed by a Routine fire — worth checking after the first few scheduled
runs actually land.
