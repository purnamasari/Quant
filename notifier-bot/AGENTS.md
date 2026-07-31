# Working on this repository

Read this before changing anything that affects which alerts get sent.

This project's value is not its code — it is a few hundred hours of
backtesting that produced a very short list of things that actually work and
a long list of things that convincingly appear to work and do not. Most of
the effort went into telling those apart. The fastest way to destroy that
value is to add a plausible-sounding signal without putting it through the
same pipeline everything else went through.

## The one rule

**No signal, filter, or strategy becomes a live alert without surviving the
full validation pipeline. No exceptions for ideas that are obviously
sensible.** Several rejected ideas below were obviously sensible.

## The validation pipeline

Run in this order. A failure at any stage means stop, not "tune until it
passes."

1. **Aggregate backtest.** Universe-wide, never per-symbol. Per-symbol
   samples here run n=7 to n=37 — thin enough that picking winners is
   curve-fitting. `src/stock/backtest.js`, `src/crypto/backtest.js`.
2. **Time-stability split.** Split the period in two and check both halves
   agree. Several signals (mean-reversion, volume-surge on stocks) flip sign
   between halves — they were riding a bull market, not an edge.
3. **Transaction-cost sensitivity.** Assume 0.15% round trip on stocks, 0.25%
   on crypto. Report where breakeven lands, not just the zero-cost number.
   Thin edges die here, which is the point.
4. **Redundancy check.** Jaccard co-occurrence against already-enabled
   signals (`src/analysis/correlateSignals.js`). A signal that fires when
   three others already fired adds nothing but correlated risk.
5. **Out-of-universe test.** Re-run on assets that were *not* used to
   develop or select anything. This is the stage that has killed the most
   convincing candidates, and it is the one most often skipped.

Only after all five: update `src/config.js` defaults, add a
`data/signal-conviction.json` entry citing the actual numbers, and write the
finding into `data/stock-signal-validation.md` or
`data/crypto-signal-validation.md`.

## Traps this project has already fallen into

These are real bugs and real false positives that were caught here. They
recur.

### Look-ahead via timestamp semantics

**OKX candle `time` is the OPEN timestamp, not the close.** A candle's close
moment is `time + interval`, i.e. the *next* candle's `time`. An early
version of `cryptoEntryRefinement.js` used `daily[i].time` as the start of
its intraday search window, which overlapped the signal day before it had
closed. It produced spectacular results (volume-surge 1.1% → 6.0%) that were
entirely artifact. After the fix (`daily[i+1].time`) the effect vanished and
the feature was dropped.

Any cross-timeframe join must compare against close time. Index-based
backtests (`walkForwardOccurrences`, `src/smc.js`) are immune because they
never touch timestamps — that was verified explicitly, not assumed.

### Look-ahead via pivot confirmation

A pivot at bar `p` is only detectable once `k` further bars have printed, since
it must be the extreme of its ±k neighbourhood. Detecting pivots on the full
series and then using them at bar `p` leaks the future. Guard with
`p + k <= signalIndex` (see `src/analysis/swingStopTest.js`).

### Survivorship bias

The crypto universe is *today's* surviving large-caps. Any strategy that
systematically buys the underperformer is inflated by this, because assets
that permanently de-rated are absent from the list. This is what made pairs
trading look profitable. Be especially suspicious of mean-reversion results.

### Isolated cell vs plateau

When sweeping parameters, a real effect appears as a contiguous region of
good cells. An artifact appears as one good cell surrounded by bad ones.
Pairs trading showed a genuine plateau (12/12 cells positive) and still
failed out-of-universe; the swing stop showed a single good cell (k=3, with
k=5 and k=8 worse than baseline) and was rejected on that basis. Apply this
standard symmetrically — it was used to reject an idea, so it must also be
used to reject a preferred one.

### Cross-market non-transfer

`ob-bullish` is the single best stock signal (+0.11%/+0.02% cost-adjusted
across both 5-year halves) and is **negative on crypto** (-0.64%).
`golden-cross` and `cup-handle` are strong on stocks and negative on crypto.
Never port a threshold across asset classes without re-validating.

### Period selection

The original stock validation used 3 years and produced three signals that
all failed once extended to 10 years and cost-adjusted. Prefer the longest
history available: 10y for stocks (Yahoo), 2y for crypto (OKX).

### Censored counts

Google News returns at most ~100 items per query, so a busy week reports
exactly 100. `src/newsStore.js` surfaces `capped` for this reason. Never
treat a capped count as a measurement.

## What has already been tested and rejected

Do not re-implement these without new evidence or a materially different
approach. Full numbers are in the two validation documents.

| Idea | Result |
|---|---|
| Bearish / short mirror signals | No kind clears the bar, stocks or crypto |
| `golden-cross`, `cup-handle` on crypto | Negative expectancy |
| `ob-bullish` on crypto | -0.64% despite being the best stock signal |
| 15m pullback / breakout entry refinement | Effect vanished after the look-ahead fix |
| 4H → 15m → 5m SMC cascade | Clearly negative (-0.43% / -0.58%, large sample) |
| Expanding cup-forming to mid-caps | 0.497R → 0.095R |
| Adding more signal kinds | All 15 tested; next best is under half as good |
| Tighter R:R targets, per-symbol tuning | No improvement; sample too thin to tune |
| Pairs trading | Passed every within-universe check, -1.77% out-of-universe |
| The entire stock alert side | 0.191R vs 0.203R for random entry dates |
| Swing stop (from the desktop Quant app) | Wins only at pivot k=3; isolated cell |
| Leverage above ~15x | Destroys the edge (see below) |

## Notifications: HIGH and above only

Detection and notification are separate decisions now. Every signal is scored
and written to `data/signal-feed.json` (the dashboard feed); only `high` and
`very-high` also get a Telegram push with a chart. `src/conviction.js`
(`shouldNotify`) owns the line, `src/deliverAlert.js` enforces it.

This is the same lesson as the stock shutdown: the failure mode is not missing
a signal, it is sending so many that the rare one gets ignored. A silent signal
is not lost — it is in the feed with `notified: false`, which is what lets you
later tell a detector gap apart from a policy decision.

Chart rendering sits inside the notify branch. It is the most expensive step in
the pipeline and must not run for something nobody is shown.

## Regime adjustment: mechanism live, evidence bar in charge

`src/regime.js` classifies BTC as bull/sideways/bear (200SMA position + slope).
`src/analysis/regimeScoreboard.js` measures every strategy per regime **against
the same-regime random control** — comparing to zero would "prove" every
strategy works in bulls — and writes `data/regime-adjustments.json`. Conviction
moves at most one tier, and only for cells that clear n>=30, |t|>2 vs random,
>=6 distinct months, and <=40% of trades in any one month.

The month guards are not decoration. Over this window bear was a SINGLE 180-day
episode, and 88% of the sideways rare-tier trades fell in three months. The
rare tier's spectacular sideways cell (+2.11R, 92.5% WR) is **refused** by guard
3. Do not remove those guards to "unlock" it.

## What is actually enabled

- **Stocks** (`alertStockKinds`): **nothing — switched off.** momentum,
  cup-forming, golden-cross and ob-bullish were enabled until a random-entry
  control was finally run on the stock side: 0.191R signal vs **0.203R random**
  (t -0.45), and confluence made it worse. Their old t-stats of 17-37 measured
  "different from zero" on a decade of rising US equities. `job.js` still sends
  the daily reminder; it just no longer scans. Full numbers and how to re-enable:
  `data/stock-signal-validation.md`, last section.
- **Crypto** (`alertCryptoKinds`): ma-alignment, near-52w-high, volume-surge.
  cup-forming and bos-bullish were dropped on 2026-07-31 after the
  OKX→Binance re-validation (cup-forming -0.24% pooled, 0 occurrences in the
  last 365 days; bos-bullish flips negative in the recent half).
- **Rare high-conviction tier** (currently unreachable — cup-forming dropped;
  re-enable only with fresh Binance evidence): cup-forming plus same-day
  confluence with ≥2 validated kinds, 7-day hold. 0.497R / 67.8% on the original 12-pair
  universe, 0.380R / 63.1% on the current watchlist. Scoped in code to
  `RARE_TIER_UNIVERSE` — scanning a pair does not make it eligible.

Note the aggregate is carried by ETH/SOL/BNB; **BTC measured -0.06R on n=37**
with this filter. That matters because BTC also tolerates the most leverage.

## Leverage: the invariant

Leverage is an **output**, never an input. Risk a fixed percentage of the
account, let the stop width set the notional, and post margin such that
liquidation sits at least 2x the stop distance away. `src/positionSizing.js`.

This is not conservatism, it is measurement. Replaying the same 118 historical
trades at each leverage (`src/analysis/leverageRisk.js`):

| leverage | avgR | win rate | liquidated |
|---|---|---|---|
| 1-5x | 0.497 | 67.8% | 0% |
| 10x | 0.495 | 67.8% | 4.2% |
| 30x | 0.304 | 47.5% | 50% |
| 100x | 0.096 | 16.9% | 83.1% |

Identical setups and entries; only the exits differ. Above ~15x the exchange's
liquidation price sits inside the ATR×1.5 stop and silently replaces it, so
noise closes trades that would have won. Do not raise
`MAX_LEVERAGE_HARD_CAP` without redoing this measurement.

## Code conventions

- CommonJS, Node 18+. The only runtime dependency is `playwright`, used
  solely for chart rendering.
- No test framework. Validation is empirical: scripts under `src/analysis/`
  that print numbers. Add to that pattern rather than introducing a harness.
- Every analysis script is standalone and runnable
  (`node src/analysis/<name>.js`), with a header comment stating what it
  tests and what the verdict was.
- Rejected experiments stay in the repo with their verdict in the header.
  They are the record of what was already ruled out.
- Comments explain *why*, especially where a non-obvious choice guards
  against one of the traps above.

## Operational safety

- **Never commit `.env`.** It holds a live Telegram bot token. It is
  gitignored; keep it that way.
- **Running `src/job.js` or `src/cryptoJob.js` sends real Telegram messages.**
  There is no dry-run flag. Use the analysis scripts for experimentation.
- `data/news-cache/` is committed on purpose — Google re-ranks and drops
  items over time, so re-fetching yields a different corpus. Committing it is
  what makes the news backtest reproducible.
- Price data comes from OKX because Binance returned HTTP 451 from the build
  environment. On a VPS with access, swapping `src/crypto/okx.js` for a
  Binance client requires no changes above it — but re-run the backtests
  afterwards, since candle boundaries differ between venues.
