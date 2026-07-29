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

## SMC (Order Block / FVG / BoS) — ported from a real TradingView indicator

At the user's request, `src/smc.js` is a faithful port of the exact Pine
Script logic from "Super OrderBlock / FVG / BoS Tools by makuchaku & eFe"
(TradingView, MPL-2.0) — not a generic reinterpretation, the actual
boolean conditions the user pasted in full. Backtested the same way as
everything else:

- **`ob-bullish` (stock) is the strongest signal in this whole bot** —
  the only one that stays positive after a cost assumption in BOTH 5-year
  test halves. Added to `alertStockKinds`.
- **`bos-bullish` (crypto)** — different result on crypto than stocks;
  added to `alertCryptoKinds`.
- **`ob-bullish` on crypto is negative** despite being the stock star —
  deliberately not enabled there. Yet another reminder these don't
  transfer across asset classes.
- `fvg-bullish`/`bos-bullish` (stock) and everything bearish — tested,
  not enabled (unstable or negative). See
  `data/stock-signal-validation.md` / `data/crypto-signal-validation.md`
  for the full numbers.

Rejection Blocks and the PPDD liquidity-sweep OB variant from the
original indicator were not ported (lower priority, more parameters to
get right).

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
tens of seconds to minutes). If you re-run the backtest scripts and the
picture changes, update this file by hand.

One kind now qualifies as VERY HIGH: crypto's `cup-forming-confluence` (not
a real detector kind — a special case of `cup-forming` firing alongside
2+ other validated crypto kinds the same day). R-multiple-backtested at
0.497 avgR / 67.8% WR (n=118, 7-day hold) — see "R-multiple search" in
`data/crypto-signal-validation.md` — clearly ahead of everything else
tested (next best is less than half as good). It's rare (~1 per 6-10 days)
and gets its own distinct Telegram banner (⭐⭐⭐ RARE HIGH-CONVICTION
SETUP, extended "hold up to 7 days" instruction) in `cryptoJob.js` instead
of blending into the normal cup-forming alert. Deliberately scoped to only
the original 12-pair crypto universe — expanding to 18 more mid-cap pairs
was tested and the edge weakened sharply there, so this tier won't fire
for a customized/wider `CRYPTO_WATCHLIST`.

## Crypto: hourly during waking hours, not just once a day

Crypto trades 24/7 and is more volatile than stocks, so `src/cryptoJob.js`
runs separately from the daily `job.js` — on its own Routine, hourly,
limited to ~05:00-22:00 WIB (`cron 0 22-23,0-14 * * *` in UTC). (Asked
for every 15 minutes originally — the Routine platform's minimum interval
is hourly, so hourly during waking hours is what's actually running.)

This does **not** mean the underlying signal logic got faster or riskier
— it's still the same daily-candle signal, backtested the same way.
Scanning more often just catches that same daily result sooner, since
crypto's UTC daily-candle cutoff (00:00 UTC = 07:00 WIB) no longer lines
up with a once-a-day check at 21:30 UTC (that timing was chosen for when
the US stock market closes, which has nothing to do with crypto). Two
statuses:
- **PROVISIONAL** — seen while today's candle is still forming
  (`confirmed: false` from OKX, see `src/crypto/okx.js`). Can still
  change or disappear before the actual close. Purely a heads-up, not
  validated behavior — the backtest never evaluated partial candles.
- **CONFIRMED** — seen after the candle has closed. This is the signal
  the backtest actually measured.

`src/cryptoDedup.js` sends at most one PROVISIONAL and one CONFIRMED ping
per symbol+kind+day so hourly polling doesn't repeat the same detection.
Stocks stay daily-only in `job.js` — market hours make a "closed vs
forming" distinction moot there in the same way.

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
- `src/cryptoJob.js` — crypto scan, run hourly during waking hours
  (separate from the daily stock `job.js`) — see above.
- `src/cryptoDedup.js` — per-day dedup so hourly crypto polling doesn't
  repeat the same PROVISIONAL/CONFIRMED alert.
- `src/deliverAlert.js` — shared chart+message+tracking delivery, used by
  both `job.js` and `cryptoJob.js`.
- `src/positionSizing.js` — turns each alert's stop width into a max safe
  leverage, notional, and margin (see "Leverage" below).
- `src/analysis/leverageRisk.js` — replays every historical setup at 1x-100x
  to measure where leverage starts destroying the edge.
- `src/analysis/fundingCost.js` — real OKX funding history expressed in R
  units, i.e. what a 7-day leveraged hold actually costs.
- `data/stock-signal-validation.md`, `data/crypto-signal-validation.md` —
  the actual backtest + correlation numbers behind the default alert
  filters in `src/config.js`. Read these before trusting the defaults.
- `data/risk-management-plan.md` — the full leveraged-trading system design:
  sizing, leverage caps, funding, correlation, circuit breakers.

## Leverage — derived per trade, not chosen

Every crypto alert carries a position plan. The rule is that **leverage is an
output, not an input**: you pick how much of the account to risk, the setup's
ATR-based stop width sets the notional, and leverage is only how much margin
you post to hold it — sized so liquidation sits at least 2x the stop distance
away, keeping the stop (not the exchange) in control of the exit.

This is not a style preference. Replaying all 118 historical
cup-forming+confluence trades at each leverage (`src/analysis/leverageRisk.js`,
avgR in original R units so the rows are comparable):

| leverage | avgR | win rate | liquidated |
|---|---|---|---|
| 1-5x | 0.497 | 67.8% | 0% |
| 10x | 0.495 | 67.8% | 4.2% |
| 20x | 0.439 | 60.2% | 18.6% |
| 30x | 0.304 | 47.5% | 50.0% |
| 100x | 0.096 | 16.9% | 83.1% |

Same setups, same entries — only the exits change. Above ~15x the exchange's
liquidation price sits inside the ATR\*1.5 stop, so it silently becomes the
stop, and normal noise starts closing trades that would have won. Because
stop width varies by pair, so does the resulting cap: BTC ~12x (3.9% stop),
most altcoins ~4-5x (8-13% stops). Hard-capped at 15x regardless.

Alerts also project the 7-day funding bill in R and warn past 0.15R. Measured
funding on OKX has been negligible (<0.04R) but that endpoint only retains
~92 days, which excludes the euphoric phases when funding actually bites — at
0.1%/8h the bill reaches 0.54R and exceeds the entire edge.

Full reasoning, worked examples, and circuit breakers:
`data/risk-management-plan.md`.

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

Three separate Routines were set up in the Claude session that built
this:
1. Daily (`node src/job.js`) — stock signal scan + H-1 digest, 21:30 UTC.
2. Hourly (`node src/macroPing.js`) — ~1h-before macro event ping.
3. Hourly, waking-hours only (`node src/cryptoJob.js`) — crypto scan,
   `cron 0 22-23,0-14 * * *` UTC (~05:00-22:00 WIB).

If that session/environment goes away, all three need to be scheduled some
other way (cron on a VPS, GitHub Actions, etc.) — nothing here depends on
Claude Code to run once scheduled with valid credentials. Confirmed
working: this environment's filesystem (including `.env`, deliberately
not in git) does survive being reclaimed after idling and resumed by a
Routine fire — verified across several real scheduled runs, not just the
initial manual test.
