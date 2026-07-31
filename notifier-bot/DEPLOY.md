# Deploying to a VPS

Hand this file to whichever agent or person is doing the deploy. It assumes
nothing about prior context — read `AGENTS.md` first if you want the "why"
behind any of this, but you can deploy correctly from this file alone.

## What this is

A Telegram bot that scans stocks and crypto for a small set of
backtest-validated signals and pushes alerts, plus a Telegram Mini App
dashboard. It is stateless apart from a handful of local JSON files (dedup
state, alert history, macro-calendar cache) — no database, no external
services beyond the public APIs it calls (Binance, Yahoo Finance, Nasdaq's
calendar, Google News RSS).

## 1. Requirements

- Node.js 18+ (built and tested on Node 22)
- ~250MB disk (Chromium for chart rendering is the bulk of it)
- Outbound HTTPS to: `fapi.binance.com`, `query1.finance.yahoo.com` /
  `query2.finance.yahoo.com`, `api.nasdaq.com`, `news.google.com`,
  `api.telegram.org`
- A Telegram bot token (from [@BotFather](https://t.me/BotFather)) and the
  chat ID that should receive alerts

**Crypto data comes from the Binance USDⓈ-M futures public API**
(`fapi.binance.com`, public endpoints only — no API key needed); see
`src/crypto/binance.js`. Binance geo-blocks some jurisdictions with HTTP 451,
so check your VPS can reach `fapi.binance.com` before deploying. Transient
5xx/network errors are already retried inside that client.

## 2. Clone and install

```bash
git clone <your-repo-url> quant-bot
cd quant-bot/notifier-bot   # this app lives in a subdirectory — see README.md
npm install                 # only dependency is playwright
npx playwright install chromium
npx playwright install-deps # system libs; Debian/Ubuntu, may need sudo
```

`src/chart.js` looks for Chromium under `/opt/pw-browsers` first (this
project's dev environment), then falls back to Playwright's normal
resolution — a plain `playwright install` works with no code changes.

## 3. Configure

```bash
cp .env.example .env
```

Edit `.env`. Minimum to run at all:

```
TELEGRAM_BOT_TOKEN=   # from @BotFather
TELEGRAM_CHAT_ID=     # your user or group id
```

Everything else has a data-driven default — see the comments in
`.env.example` before overriding any of them, especially
`ALERT_STOCK_KINDS` (see §6, stock alerts are deliberately disabled) and
`CRYPTO_WATCHLIST`. Worth setting explicitly:

- `ACCOUNT_SIZE` — without it, alerts show leverage ratios but not concrete
  position sizes.
- `RISK_PERCENT`, `MAX_CONCURRENT_POSITIONS` — position sizing inputs, see
  `data/risk-management-plan.md`.

**`.env` must never be committed.** It's gitignored already; double-check
with `git check-ignore -v .env` before your first commit from this machine.

## 4. Smoke test before scheduling anything

Run each job by hand once. They send real Telegram messages, so success is
self-evidencing.

```bash
node src/macroPing.js      # should print "0 reminder(s) + 0 result(s) sent" (or more, if something's due)
node src/cryptoJob.js      # scans crypto, sends alerts if any signals fire
node src/job.js            # daily stock job — sends the H-1 reminder only; stock scanning is disabled (see §6)
```

If nothing arrives in Telegram and no error printed, the cause is almost
always a wrong `TELEGRAM_CHAT_ID`, not a scan failure — a scan with no
matching signals exits silently and just logs `0 new alert(s)`.

## 5. Schedule the jobs

Three separate schedules, because they run at different cadences:

| job | schedule | why |
|---|---|---|
| `node src/cryptoJob.js` | every hour, ~05:00-22:00 WIB (22:00-14:59 UTC) | crypto trades 24/7 but the signal finalizes at the UTC daily candle close; hourly polling just catches it sooner, see header comment in `cryptoJob.js` |
| `node src/macroPing.js` | every hour, all day | catches macro releases ~1h ahead and announces results after |
| `node src/job.js` | once a day, e.g. 00:05 UTC | sends the H-1 daily reminder (macro/earnings/unlocks for tomorrow); stock signal scanning is a no-op (see §6) but still runs fast |

Example crontab (adjust paths and timezone):

```cron
# crypto scan, hourly during waking hours (UTC times)
0 22-23,0-14 * * * cd /path/to/quant-bot/notifier-bot && /usr/bin/node src/cryptoJob.js >> /var/log/quant-crypto.log 2>&1

# macro ping, every hour
5 * * * * cd /path/to/quant-bot/notifier-bot && /usr/bin/node src/macroPing.js >> /var/log/quant-macro.log 2>&1

# daily stock/reminder job
5 0 * * * cd /path/to/quant-bot/notifier-bot && /usr/bin/node src/job.js >> /var/log/quant-daily.log 2>&1
```

If your scheduler doesn't support sub-hourly or the exact UTC window,
running `cryptoJob.js` hourly around the clock is harmless — it dedupes
internally (`data/.crypto-alert-dedup.json`) so extra runs just no-op.

**Do not run multiple instances of the same job concurrently** — they share
local dedup/state files with no locking.

## 6. Known, deliberate state — don't "fix" these

- **Stock signal alerts are switched off.** `alertStockKinds` defaults to
  empty. This was measured, not an oversight: stock signals do not beat a
  random entry date (0.191R vs 0.203R random, see
  `data/stock-signal-validation.md`, last section). The daily reminder
  (macro/earnings/unlocks) still runs. To re-enable, set
  `ALERT_STOCK_KINDS` in `.env` — but re-run
  `npm run control:stock` first and confirm it beats the random-entry
  column before trusting it.
- **Notifications are HIGH conviction and above only.** Medium/low signals
  are still detected and written to `data/signal-feed.json` (the dashboard
  reads this) but do not push to Telegram. See `src/conviction.js`
  (`shouldNotify`) and `AGENTS.md`.
- **BTC break-of-structure alerts are context, not trade signals.** Worded
  that way deliberately — measured no edge (`|t| < 1.7` on both 1D and 4H).
  See `src/marketStructure.js`.
- **The rare high-conviction crypto tier** (`⭐⭐⭐`) is scoped to
  `RARE_TIER_UNIVERSE` in `src/crypto/universe.js`, not the full scan list.
  Expanding `CRYPTO_WATCHLIST` does not automatically make new pairs
  eligible for it — that was tested and rejected (edge drops sharply
  out-of-universe).

If you disagree with any of the above, the point is that the data is in the
repo (`data/*-signal-validation.md`) — re-run the relevant script and look at
the numbers before changing behavior, not just the config.

## 7. Regenerating the data files periodically

A few `data/*.json` files are precomputed by analysis scripts and read live
by the bot. They don't need to be regenerated on every deploy, but should be
refreshed periodically (say, monthly) as more market history accumulates:

```bash
npm run scoreboard          # data/strategy-stats.json — per-strategy expectancy the alert messages quote
npm run scoreboard:regime   # data/regime-adjustments.json — regime-based conviction adjustments
```

Both read from `data/export/` (cached candles, committed to the repo)
and need no network access to run. Re-run `node src/analysis/exportSignals.js`
first if you want them computed against fresher candles — that one does hit
Binance.

## 8. The Mini App dashboard (optional)

```bash
DASHBOARD_PORT=8787 node src/dashboard/server.js
```

Serves a mobile-first Telegram Mini App: regime (crypto + stocks), money
flow, active signals with per-token detail, news, and upcoming
events/earnings with countdowns.

**To actually use it as a Telegram Mini App:**

1. Put it behind HTTPS (nginx/caddy reverse proxy + a real TLS cert — Telegram
   requires HTTPS for Mini Apps, no exceptions).
2. Register the URL with [@BotFather](https://t.me/BotFather):
   `/mybots` → your bot → `Bot Settings` → `Menu Button` → set the Mini App
   URL to your HTTPS endpoint.
3. Leave `DASHBOARD_REQUIRE_AUTH` unset or `true` (the default). This
   verifies Telegram's signed `initData` against your bot token
   (HMAC-SHA256, constant-time compared, age-limited) and checks the
   requesting user matches `TELEGRAM_CHAT_ID` — without this, anyone who
   finds the URL sees your positions and signal history. Only set it to
   `false` for local development on a machine nobody else can reach.

Run it under the same process manager as the cron jobs (pm2, systemd, or a
plain `nohup` + `screen`/`tmux` if you're keeping this simple) so it survives
reboots. It reads the same `data/*.json` files the cron jobs write, so no
separate data pipeline is needed.

## 9. Health checks

- `node src/macroPing.js` exits 0 and prints a count on success. A fatal
  error prints to stderr and exits 1.
- `node src/cryptoJob.js`: if **all** configured pairs fail in one run (not
  just one), it treats that as a data outage — sends one deduped Telegram
  warning and exits 1, rather than logging silently. A monitoring wrapper
  that alerts on repeated nonzero exits is more informative than one that
  just checks "is the process running".
- `GET /healthz` on the dashboard returns `{"ok":true}` when the server is up
  (does not check the data files or Telegram token — this is a liveness
  check only).

## 10. If something looks wrong after deploy

Read `AGENTS.md` first — it documents every trap this project has already
fallen into (look-ahead bias, survivorship bias, period selection, etc.) and
what's already been tested and rejected. Re-implementing something listed
there without new evidence just re-discovers the same failure. If the numbers
genuinely look stale, the fix is running the relevant script in
`src/analysis/` and updating the corresponding `data/*.md` file with the new
result — not reverting the shipped default back to the old comment.
