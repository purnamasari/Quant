# Roadmap

State at handover, and what is worth doing next. Ordered by value, not by
effort. Read `AGENTS.md` first — several items below are only worth doing if
they go through the validation pipeline described there.

## Highest value — a live lead, one step from actionable

### 1. Confirm the "quiet setups outperform" effect, then implement it

The news backtest is **done** (416 windows harvested, corpus committed) and
produced a genuine lead. Full numbers in `data/crypto-signal-validation.md`.

Two hypotheses were tested and both point the same way — news coverage is a
*headwind* for this setup, not a tailwind:

- **H2 (rejected):** entering on a news spike with no price signal is
  negative on all four coins tested (-0.122R overall). The original "trade
  price action after news" idea does not work as a standalone trigger.
- **H1 (promising, not implemented):** among cup-forming+confluence signals,
  performance falls monotonically as coverage rises — quiet 0.508R, normal
  0.288R, busy 0.103R, against a 0.435R baseline.

H1 is not implemented because the split is 71 quiet trades against 27
non-quiet, and a ~0.27R gap at n=27 is about one standard error. Suggestive,
not established.

**What would settle it**, in rough order of cost:

1. Extend the corpus to the remaining watchlist coins (XRP, DOGE, ADA, ZEC,
   HYPE, NEAR, AAVE, ONDO). The harvest is resumable and caches forever; add
   them to `COINS` in `newsBacktest.js` and re-run. This roughly doubles the
   sample at the cost of another rate-limited harvest.
2. Fix the censoring. 194 of 416 weekly windows hit Google's ~100-item cap,
   so busy weeks are undercounted and some busy days are misclassified as
   quiet. Note this bias works *against* the finding, so the true effect is
   probably stronger — but daily-granularity queries around signal days
   would measure it properly.
3. If it holds, wire it into `cryptoJob.js` as a **conviction modifier**, not
   a new alert kind — it modifies a setup that already exists. A loud
   cup-forming signal would drop a tier rather than be suppressed.

## High value

### 2. Real scheduling on the VPS

The three jobs currently run via Claude Code Routines, which do not exist
outside that environment. They must be re-created as cron entries. See the
Scheduling section of `README.md` for the exact crontab. **Nothing runs until
this is done** — this is the first deployment task, not an optional one.

Verify after setup: `node src/macroPing.js` should complete and print
`0 reminder(s) sent` on a quiet hour without error.

### 3. Try Binance directly

Binance returned HTTP 451 from the build environment, so everything uses OKX
(`src/crypto/okx.js`). A VPS in a permitted jurisdiction may reach it. This
matters because Binance is the actual trading venue, and OKX/Binance daily
candles were observed to differ by 0.01%-1.24% — enough to shift a signal by
a day.

Swapping the client requires no changes above it (same candle shape), but
**re-run the crypto backtests afterwards** — different candle boundaries
mean the validation numbers are not automatically transferable.

Do not attempt to circumvent a geographic block. If the VPS cannot reach it
legitimately, stay on OKX.

### 4. Validate `funding-extreme`

The only signal in the codebase with **no historical backtest at all**. It is
detected (`src/crypto/signals.js`) but deliberately excluded from alerts.
OKX's `funding-rate-history` endpoint retains ~92 days — verified, that is an
API limit and not a pagination bug — which is thin but enough for a first
pass. `src/analysis/fundingCost.js` already has the fetching and pagination.

Note it currently has a legitimate non-signal use as a carry-cost filter
(`positionSizing.js` warns above 0.15R projected), which does not require
this validation.

### 5. Outcome tracking that actually closes the loop

`src/tracking.js` logs FOLLOW/SKIP button presses, but only by polling
`getUpdates` on the next scheduled run — so a press is recorded minutes to
hours late, and nothing records what the trade *did*. There is no measurement
of live performance versus backtested expectancy.

Worth building: record entry/stop/target at alert time, then check outcomes
after the hold window and compare realised R against the 0.380-0.497R the
backtest predicts. Divergence is the earliest warning that an edge has
decayed. Currently there is no such warning.

## Medium value

### 6. Macro event reaction backtest

The remaining untested piece of the news idea, and the one the user asked
about originally: do entries in the 24 hours *after* a major macro release
behave differently from baseline? Needs a historical macro calendar; the
Nasdaq endpoint behind `src/macro.js` may serve past dates — unverified.

Practical value even if the answer is null: it would justify or retire the
current guidance not to open leveraged positions inside the H-1 window.

### 7. Re-test the swing stop at larger sample

Quant's swing stop (`min(nearestSupport, entry - ATR*0.7)`) beat ATR×1.5 at
pivot window k=3 on both axes — higher avgR (0.402 vs 0.380) *and* a tighter
stop permitting 8.1x leverage instead of 6.6x. Rejected because k=5 and k=8
were both worse, making it an isolated cell on n=111.

Worth revisiting once more signals accumulate. If k=3 turns into a plateau it
is a genuine double win. `src/analysis/swingStopTest.js` is ready to re-run.

### 8. Re-validate on a schedule

Every backtest here is a snapshot of 2022-2026 crypto and 2016-2026 stocks,
both broadly rising. Expectancy numbers carry some baseline drift, not pure
pattern edge. Re-run the validation scripts quarterly and update
`data/signal-conviction.json` when the picture moves. Nothing currently
prompts this.

## Low value / explicitly deprioritised

- **More signal kinds.** All 15 long-side kinds were swept; the next best
  after cup-forming is under half as good.
- **Wider coin universe.** Tested on 18 mid-caps: 0.497R → 0.095R.
- **Intraday / scalping variants.** Every one tested (15m pullback, 15m
  breakout, 4H-15m-5m cascade) came out negative, and the user's own history
  with scalping is unprofitable.
- **ML / RL / genetic strategies.** Sample sizes are in the hundreds. Those
  methods would fit noise, and there is no infrastructure for them here.
- **Stock-side expansion.** The stock path works but is secondary to crypto
  in actual use; the crypto job runs hourly, stocks once daily.

## Known gaps worth being honest about

- Crypto validation is 12 pairs over 2 years. That is a small universe and a
  short, mostly-rising period.
- ZEC and HYPE produce zero qualifying signals in 2 years — recent listings
  with insufficient history. They are scanned but contribute nothing yet.
- `data/token-unlocks.json` is hand-maintained; no live API was found for
  unlock schedules.
- The rare tier fires roughly once per 6-10 days. That is by design, but it
  means live-sample accumulation for item 5 will be slow.
