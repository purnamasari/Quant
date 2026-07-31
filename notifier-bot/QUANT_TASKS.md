# QUANT_TASKS.md — signal-bot task list & improvement backlog

Single source of truth for the Telegram signal-bot (`notifier-bot/`) work
items. Distinct from `TASKS.md` (execution-bot roadmap) and `ROADMAP.md`
(product vision). Items are done only when their stated check passes.

Legend: `[x]` done · `[ ]` open · `[~]` in progress · 🔬 evidence-backed
improvement candidate · ⏳ needs product decision

---

## ✅ Done — 2026-07-31 Binance migration & re-validation

- [x] **Data source OKX → Binance USDⓈ-M futures** (`src/crypto/binance.js`).
      Check: 17 require sites rewired, `okx.js` deleted, live scan 12/12 pairs
      OK. Commit `1498d6b`.
- [x] **Telegram topic delivery** (`TELEGRAM_THREAD_ID`). Check: test message
      lands in Milky Way HQ topic 662 (msg id verified). Commit `7e88b5e`.
- [x] **Universe re-validation on Binance** (pooled / cap-tier / time-stability
      / rare-tier / regime / event lenses). Check: numbers in
      `data/binance-revalidation-2026-07-31.md`.
- [x] **Regime-gated policy (Policy C)** — `config.regimeGates`:
      cup-forming → bear/sideways (EXPLORATORY, fails own guards), bos-bullish
      → sideways (GUARD-BACKED). Check: gate filter live, 0 alerts on a
      non-matching regime. Commit `6d14a4d`.
- [x] **Rare-tier re-check with shipped exit rule** (no-target, 14-day hold):
      0.841R / n=97 full window but **n=0 in the recent 365 days** → NOT
      re-validated; documented as unproven. Commit `72abba9`.
- [x] **Push to `purnamasari/Quant` branch `notifier-binance`** (6 commits via
      SSH as ashcel). Check: remote HEAD == local HEAD.

## ✅ Chart / UX improvements

- [x] 🔬 **Probabilistic forecast overlay (ForecastEngine + lightweight-charts)**
      — engine v1 (`FORECAST_ENGINE_VERSION = 1`).
      Files: `src/forecast/engine.js` (engine), `src/forecast/engine.test.js`
      (smoke test, `node src/forecast/engine.test.js`), `src/chart.js`
      (Lightweight Charts v4.2.0 renderer, vendored at
      `src/chart/vendor/lightweight-charts.standalone.production.js`, inlined —
      the rendered page makes no network request), `src/forecast/input.js`
      (`buildForecastForAlert`, seeded `djb2(symbol|kind|YYYY-MM-DD)` — lived in
      `src/deliverAlert.js` until the one-message change below moved it).
      Draws 12 projected candles after the last real one: translucent second
      candlestick series + ATR·√i confidence cone + dashed path + boundary
      divider + "FORECAST ⟶" chip + TP/SL hit probabilities from a 200-path
      ensemble.
      ⚠️ **Not a prediction.** The projection is a deterministic seeded random
      walk shaped by the plan (entry/stop/target, ATR, direction, signal
      strength) — same alert re-renders byte-identically, and it carries no
      forecasting skill. Forecast failure degrades to a plain chart (try/catch,
      `forecast: null`); the stock path is unchanged.
      Check: `node src/forecast/engine.test.js` all-pass; sample render
      `/tmp/forecast-sample.png`.
- [x] **One-message alerts (photo + caption + buttons)** — every push is now a
      single Telegram message instead of photo-then-text. `src/deliverAlert.js`
      calls `sendPhoto(png, caption, { replyMarkup: keyboardFor(alertId) })`;
      the separate `sendMessage` survives only as the render-failure fallback,
      so a chart error degrades to text-only instead of dropping the alert.
      Forecast construction moved out of `deliverAlert.js` into
      `src/forecast/input.js` (`buildForecastForAlert`) and is now called from
      `cryptoJob.js`, so the alert object carries `forecast` end-to-end and the
      chart and the caption read the same projection.
      Check: format smoke prints 416 chars (limit 1024); render smoke writes a
      30 KB PNG; `env TELEGRAM_BOT_TOKEN= node src/cryptoJob.js` scans 12/12.
- [x] **Simplified alert text** (`src/format.js`) — the caption limit is 1024
      chars, so the message was cut to what changes a decision. Removed: the
      `vs entry acak … rank #x/y` sub-line (the edge-vs-random figure still
      reaches the message via the "Kenapa" line), the `⏱ Exit:` reminder, the
      four-row `⚙️ Position plan` block (now one `Max aman Nx → pakai Mx` line;
      `position.warnings` still print), the regime `(+0.23R di regime ini, n=…)`
      parenthetical. News capped at 2 items. Added: `🎯 TP x% · SL y% · ~n bar
      ke TP` from the forecast ensemble metadata (`forecastMeta` param).
- [x] **Daily BTC bias job (08:00 WIB)** — `src/dailyBias.js`, one context
      message per day: regime, 1D/4H structure bias (+ ⚠️ konflik when they
      disagree), close, 7d/30d change, distance to 200SMA, and a per-regime
      one-liner. Exactly one message (photo + caption): the chart follows a
      weekday cadence — **Monday sends BOTH charts as one album** (1D
      7-candle weekly forecast + 4H 12-candle intraday forecast), Tue–Sun
      sends the 4H chart alone; the caption still reports both biases either
      way, and a failed forecast/render degrades to text-only.
      Context framing only, never an entry. `sendMessage` only — no
      `getUpdates`, which would steal callbacks from the tracking poller on the
      shared bot token. Cron:
      ```
      0 1 * * * cd /home/ubuntu/code/quant-notifier/notifier-bot && /usr/bin/node src/dailyBias.js >> /home/ubuntu/quant-logs/quant-bias.log 2>&1
      ```
      Check: live run exits 0 and the message landed in topic 662.

## 🔬 Quant improvement candidates — 2026-07-31 sweep (Binance, 12 pairs, 730d, cost 0.25%, hold 2)

Evidence scripts: `/tmp/improvement-sweep.js`, `/tmp/robustness-check.js`
(re-run pattern in `data/binance-revalidation-2026-07-31.md` §1 methodology).

### 1. volume-surge threshold 1.75 → 2.5× (HIGH VALUE, stable)
| vol ≥ | n | expectancy | older half | recent half |
|---|---|---|---|---|
| 1.75 (base) | 362 | +1.74% | +1.73% | +1.75% |
| 2.00 | 254 | +1.60% | — | — |
| **2.50** | **141** | **+2.87%** | +1.38% | +5.21% |
| 3.00 | 82 | +3.43% | — | — |

Monotonic improvement, positive in both halves. Trade-off: fewer signals
(141 vs 362). Check: threshold configurable; sweep re-run shows the same
ordering on fresh data.
**Status: [x] implemented 2026-07-31 (commit 6df11ed).** `config.volumeSurgeRatio`
(env `VOLUME_SURGE_RATIO`, default 2.5) is threaded into `detectStockSignals`
via opts from `crypto/signals.js` and `crypto/backtest.js`. Stock callers pass
nothing and keep the 1.75 default. Verified: `node src/crypto/backtest.js`
reports volume-surge n=141, +3.12% raw = **+2.87% at 0.25% cost**.

### 2. near-52w-high proximity 4% → 2% (MEDIUM VALUE, stable)
| dist ≤ | n | expectancy | older | recent |
|---|---|---|---|---|
| 4% (base) | 283 | +1.49% | +1.29% | +2.10% |
| 3% | 181 | +1.77% | — | — |
| **2%** | **100** | **+2.36%** | +2.30% | +2.52% |
| 1% | 40 | +2.70% | — | — |

**Status: [x] implemented 2026-07-31 (commit 6df11ed).** `config.nearHighPercent`
(env `NEAR_HIGH_PERCENT`, default 2), same opts path as §1; stock default stays
4%. Verified: backtest reports near-52w-high n=100, +2.61% raw = **+2.36% at
0.25% cost**.

### 3. Confluence quality tier — 2+ of the 3 unconditional kinds same-day (HIGH VALUE, stable)
| filter | n | expectancy |
|---|---|---|
| any single kind only | 1023 | +0.58% |
| **≥2 kinds same day** | **594** | **+2.79%** (older +2.39 / recent +3.67) |

Confluence ≈ 5× the singles-only expectancy. Suggests a conviction boost
(or separate quality tier) when multiple unconditional kinds agree.
**Status: [x] implemented 2026-07-31 (commit 6df11ed)** — surfaced as a conviction
boost, not a new tier. `convictionFor(..., { boost })` promotes one tier
through the existing capped `step`, so confluence can reach HIGH but never
manufactures VERY HIGH (that badge stays reserved for a setup measured under
its own name). `cryptoJob.js` counts same-day `UNCONDITIONAL_KINDS` and passes
`boost: 1` at ≥2, plus a "why" line. The rare tier passes `boost: 0` — its own
measurement already prices confluence in, so boosting would double-count it.

### 4. HOLD_DAYS 2 → 3/5 (HIGH VALUE, needs product decision)
| kind | h=2 | h=3 | h=5 | h=7 |
|---|---|---|---|---|
| ma-alignment | +1.24% | +2.01% | +3.49% | +4.73% |
| near-52w-high | +1.49% | +1.82% | +2.01% | +2.87% |
| volume-surge | +1.74% | +1.51% | +3.04% | +3.54% |

Longer holds roughly double-to-triple the 2-day metric. ⚠️ Close-to-close
metric; real stops/funding differ; longer exposure ≠ free lunch.
**Status: ⏳ Dee decides the alert horizon framing (2-day is the shipped
branding; the rare tier already uses 7-day framing).**

### 5. Cost model 0.25% → 0.15% (REPORTING, not code)
Binance futures round-trip ≈ 0.10–0.14% taker. The 0.25% assumption makes
real edges look ~0.15pp worse than they are (ma 1.24→1.39, near 1.49→1.64,
vol 1.74→1.89). **Status: ⏳ keep conservative until live fill data exists.**

## ⏳ Open backlog

- [ ] **Rare-tier re-validation** when the current (bear/sideways) regime
      accumulates enough fresh occurrences to pass n≥30 + month guards.
- [ ] **Funding / OI filter research** — funding-extreme is detected but
      never alerted; test funding-rate as a long-side filter (crowded-long
      avoidance) with `/fapi/v1/fundingRate` history.
- [ ] **PR creation** for `notifier-binance` → `notifier-bot` (or `main`) —
      link: https://github.com/purnamasari/Quant/pull/new/notifier-binance
- [ ] **`job.js` daily job** — skipped on deploy because its `getUpdates`
      polling conflicts with the shared Hermes bot token. Revisit if Dee gets
      a dedicated bot token.
- [x] **Mini App dashboard — DEPLOYED 2026-07-31** —
      `https://quant.dev.heydewi.com` (Caddy HTTPS + systemd
      `quant-dashboard.service`, port 8787, `DASHBOARD_REQUIRE_AUTH` on).
      Next: BotFather menu button (see DEPLOY.md §8).
- [ ] **Weekly scoreboard refresh** — `npm run scoreboard` /
      `npm run scoreboard:regime` after threshold changes land.

## How to re-run the evidence

```bash
cd ~/code/quant-notifier/notifier-bot
node /tmp/improvement-sweep.js    # threshold / hold / confluence / cost sweeps
node /tmp/robustness-check.js     # halves-split robustness for candidates
npm run backtest:crypto           # pooled universe backtest (Binance source)
```
