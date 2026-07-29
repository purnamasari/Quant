# Crypto signal validation

`npm run backtest:crypto` (see package.json), 10 pairs (BTC/ETH/SOL/BNB/XRP/
DOGE/ADA/AVAX/LINK/LTC via OKX), 2 years daily history, 2-day hold. Same
detection code as stocks (`src/stock/signals.js`) reused as-is — this
backtest exists specifically to check whether that reuse is actually valid
on crypto, rather than assuming it.

| kind | trades | win rate | avg return | expectancy |
|---|---|---|---|---|
| new-52w-high | 24 | 50.0% | 2.22% | 2.22% (tiny sample, ignore) |
| ma-alignment | 805 | 52.3% | 1.13% | 1.13% |
| near-52w-high | 241 | 46.1% | 1.11% | 1.11% |
| volume-surge | 331 | 48.0% | 0.89% | 0.89% |
| cup-forming | 441 | 56.9% | 0.69% | 0.69% |
| mean-reversion | 164 | 55.5% | 0.67% | 0.67% |
| vcp | 1301 | 49.6% | 0.46% | 0.46% |
| macd-bullish | 3276 | 48.0% | 0.13% | 0.13% |
| rebound | 1111 | 45.4% | -0.05% | -0.05% |
| momentum | 1110 | 47.2% | -0.19% | -0.19% |
| golden-cross | 181 | 38.1% | **-1.05%** | **-1.05%** |
| cup-handle | 13 | 38.5% | **-1.76%** | (tiny sample, but negative) |

## Important: crypto defaults are NOT the same as the stock defaults

`golden-cross` and `cup-handle` — two of the best-performing signals on
stocks — show **negative** expectancy on this crypto universe/period. This
is exactly the warning given earlier in the conversation: don't reuse
equity-tuned pattern rules on crypto unchanged and assume they still work.

**Default alert filter used by `job.js` for crypto:** `ma-alignment`,
`near-52w-high`, `volume-surge`, `cup-forming` — deliberately excludes
golden-cross and cup-handle given the negative backtest result above.

## Bearish/short mirror signals — tested, NOT enabled

Same 9 bearish mirror signals as stocks, same methodology, 12 pairs
(added ZEC-USDT, HYPE-USDT to the validation universe). Result is the same
conclusion as stocks: no bearish kind clears a meaningful bar.
`rebound-down` (+0.05%, n=1244) and `near-52w-low` (+0.42%, but n=91 and
37% win rate — high variance, not trustworthy) are the closest to
breakeven; everything else (death-cross, volume-surge-down,
mean-reversion-short, golden-cross's mirror, cup-handle's mirror) is
clearly negative. **None enabled in `config.alertCryptoKinds`.** Same
caveat as stocks applies: this window was broadly a rising market for
majors, so shorting underperforming here doesn't mean it always would.

## Improvement pass follow-ups

**Jaccard redundancy check (was a known gap, now done):** 12 pairs, same
methodology as stocks. Top overlaps: `ma-alignment|momentum` (0.285),
`macd-bullish|vcp` (0.264) — consistent with the stock findings (moving
average and MACD-family signals tend to co-fire). The four enabled
defaults (ma-alignment, near-52w-high, volume-surge, cup-forming) are not
among the highly-correlated pairs, so they're not just re-describing each
other.

**Cost sensitivity (0.25% round-trip — wider than stocks' 0.15% given
typically higher effective crypto spreads + perpetual funding drag over a
2-day hold):** all four current defaults stay comfortably positive —
volume-surge 0.91%, ma-alignment 0.88%, near-52w-high 0.79%, cup-forming
0.44%. Crypto's larger raw volatility gives these more room above the cost
floor than stocks had. No change needed to `alertCryptoKinds`.

**OKX vs Kraken sanity check:** BTC daily closes compared for 5 recent
days — differences ranged 0.01%-1.24%, most likely from different UTC
candle-close conventions between exchanges rather than a broken feed. Not
alarming, but a reminder that OKX-sourced signals could occasionally fire
a day earlier/later than the same pattern would on Binance itself.

## SMC signals (Order Block / FVG / BoS) — same port as stocks, different result

Same `src/smc.js` port tested on the 12-pair crypto universe (2y, 0.25%
cost assumption):

| kind | cost-adjusted expectancy | trades |
|---|---|---|
| **bos-bullish** | **0.52%** | 464 |
| fvg-bullish | -0.28% | 694 |
| bos-bearish | -0.45% | 502 |
| ob-bullish | **-0.64%** | 509 |
| ob-bearish | -0.74% | 521 |
| fvg-bearish | -1.27% | 792 |

**Important cross-market result:** `ob-bullish` was the single best signal
found on stocks (see data/stock-signal-validation.md) but is clearly
negative on crypto. `bos-bullish` — mediocre/unstable on stocks — is the
one that works here instead, with low redundancy (<0.15 Jaccard) against
the other four crypto defaults. **Added `bos-bullish` to
`alertCryptoKinds`; did NOT add ob-bullish despite it being the stock
star.** This is the clearest demonstration yet in this bot of why
thresholds/signals don't automatically transfer across asset classes —
worth remembering before assuming anything else does either.

## Entry refinement (15m pullback/breakout) — investigated, NOT implemented

At the user's request, tested whether waiting for a 15m EMA9 pullback
bounce or a 15m range-breakout confirmation (instead of entering
immediately at the daily signal's close) improves results —
`src/analysis/cryptoEntryRefinement.js`.

**First pass had a look-ahead bug**: OKX daily candle `time` is the OPEN
timestamp, not close (verified: the still-forming candle's time is up to
24h in the past). The search window used `daily[i].time` as its start,
which is a full day too early — overlapping the signal day itself before
it even closed. That run showed dramatic-looking wins (e.g. volume-surge
baseline 1.1% → pullback 6.0%) that were an artifact of this bug, not a
real edge.

**After fixing it** (`sessionStart = daily[i+1].time`) and re-running —
this time only BTC-USDT's data came through (OKX returned HTTP 503 for
the other 6 pairs, likely rate-limited from repeated backtest runs) — the
apparent edge mostly disappeared:

| kind | baseline | pullback | breakout |
|---|---|---|---|
| ma-alignment | 0.12% | 0.09% | 0.00% |
| near-52w-high | 0.03% | 0.09% | -0.04% |
| volume-surge | -0.09% | -0.29% | -0.36% |
| cup-forming | 0.03% | 0.02% | 0.19% |

**Conclusion: not implemented.** Entering immediately at the daily
signal's close (the existing behavior) is not clearly beaten by waiting
for a lower-timeframe pullback or breakout, once the timing bug is fixed.
Worth re-running across the full pair set once OKX stops 503ing to get a
more complete answer, but a single major pair (BTC) already showed the
effect essentially vanish, so expectations should stay low. `src/risk.js`
gained an `entryOverride` param and `src/cryptoEntryTrigger.js` exists as
reusable infra if this gets revisited later — neither is wired into
`cryptoJob.js`.

## R-multiple search for a 0.5-1R strategy (holding period, tighter target, confluence)

Motivation: `riskPlanFor`'s live ATR*1.5 stop / 1.8R target only measured
0.05-0.12R average expectancy at the default 2-day hold across all
validated kinds — thin. Ran a systematic search (`src/analysis/
rMultipleBacktest.js`) across extended holds (5/10 days), a tighter 1:1 R:R
target, and same-day confluence (2+ validated kinds firing together),
across all 15 long-side signal kinds, 12-pair universe, 2 years.

**Result: `cup-forming` + confluence (>=2 validated kinds same day) + 7-day
hold is uniquely good** — 0.497 avgR, 67.8% WR, n=118. Next best
(`ma-alignment`, same conditions) is 0.226R — less than half as good.
Everything else in the 15-kind sweep is 0.06-0.22R or negative
(momentum/cup-handle/golden-cross/mean-reversion all negative under these
conditions). Tighter 1:1 targets and per-symbol optimization were also
tried and rejected — see git history for the full experiment log.

Real-world frequency: n=118 over 2 years / 12 pairs ≈ 1 signal per ~6 days
system-wide, or roughly 1 per 6-10 days on a typical 7-pair watchlist. This
is a rare, special-occasion alert, not a daily one — implemented as a
distinct "rare high-conviction" tier in `cryptoJob.js` (separate banner,
`⭐⭐⭐ VERY HIGH` conviction, explicit "hold up to 7 days" instruction,
own dedup key `cup-forming-confluence`) rather than folded into the normal
cup-forming alert.

### Does expanding the coin watchlist reproduce more of this edge? Tested — no.

Asked whether it's better to grow the coin watchlist (more symbols = more
chances for the same validated pattern) or add more strategies (more kinds
= more triggers), given the rare-alert concern above. Already established
more strategies doesn't work (15-kind sweep above). Tested the watchlist
side directly: added 18 established mid-cap pairs never used in any prior
backtest (DOT, TRX, SUI, NEAR, APT, ICP, ETC, FIL, ATOM, UNI, AAVE, ARB, OP,
INJ, RENDER, ONDO, HBAR, ALGO) and ran the exact same cup-forming +
confluence>=2 + 7-day-hold methodology on them in isolation:

| universe | trades | win rate | avg R |
|---|---|---|---|
| original 12 (large-cap) | 118 | 67.8% | **0.497** |
| new 18 (mid-cap) | 79 | 43.0% | **0.095** |

**The edge does not transfer to mid-caps** — win rate roughly halves and
avgR drops ~80%. Per-symbol breakdown (no confluence filter) shows high
variance rather than uniform mediocrity (DOT 0.645R n=19, RENDER 0.828R
n=11, NEAR 0.356R n=21 look good; APT -0.418R, ATOM -0.508R, UNI -0.465R,
AAVE -0.478R, INJ -0.802R look bad) — but sample sizes per symbol are too
small (n=7-37) to trust cherry-picking individual winners without risking
the same overfitting problem already flagged earlier in this doc.

**Conclusion: do not blindly expand `crypto/universe.js`'s
`DEFAULT_VALIDATION_UNIVERSE`.** The rare high-conviction tier stays scoped
to the original 12 pairs (enforced in code via an explicit
`DEFAULT_VALIDATION_UNIVERSE.includes(symbol)` guard in `cryptoJob.js`, so
it won't silently activate even if `CRYPTO_WATCHLIST` is customized to a
wider set). If more alert volume is wanted later, the safer path is
validating specific additional large-cap-quality symbols individually with
a longer history, not batch-adding mid-caps for volume's sake.

## Pairs trading — tested as a side strategy, REJECTED

Proposed because it is the one candidate whose alpha does not come from the
same beta-to-BTC factor every other signal here shares: long the
underperformer, short the outperformer on the log spread, betting the
relationship reasserts itself. `src/analysis/pairsTrading.js`.

Methodology, with the anti-fooling-yourself steps that this strategy
specifically needs:

- **Multiple testing.** 12 assets = 45 usable pairs. Pairs were SELECTED on
  the first half of history (correlation > 0.5 and profitable in-sample) and
  TRADED only on the second half. Only the out-of-sample number counts.
- **Parameter overfitting.** A lookback x entry-z grid was swept and every
  cell reported, never just the best.
- **Cost.** Two legs = double fees; 0.5% round trip applied throughout, then
  stress-tested further.

### On the 12 large-caps it looked real

Out-of-sample, selected pairs, 0.5% cost: **+1.363% net per trade, 61.0% win
rate**, median hold ~12 days. And it passed the checks that usually kill a
result:

- **Parameter plateau, not a spike.** The whole block lookback 28-35 x entry-z
  2.4-2.6 is positive (12 of 12 cells, +0.35% to +2.24%). An artifact
  normally lives in one isolated cell.
- **Stable across an OOS time-split:** +2.266% (first half) vs +2.211%
  (second half).
- **Not outlier-driven:** removing the three biggest winners still leaves
  +1.309%.
- **Cost breakeven at ~1.86% round trip** — far above the realistic ~0.2-0.5%
  for major perps.

### The out-of-universe test killed it

The one warning sign was concentration: only 8/14 selected pairs were
positive, and the winners clustered on pairs involving LTC and DOGE. So the
same plateau parameters were run on the 18 mid-cap pairs never used anywhere
in this analysis (153 pairs, n=6292 — eight times the data):

| universe | trades | win rate | net/trade | gross (no cost) |
|---|---|---|---|---|
| 12 large-caps | 785 | 61.0% | **+1.363%** | +1.863% |
| 18 mid-caps | 6292 | 50.1% | **-1.765%** | **-1.265%** |

Negative *before costs*, at a 50.1% win rate — a coin flip — on the far larger
sample. Only 29/91 selected pairs positive. The worst pairs are exactly what
theory predicts when mean reversion is the wrong model: NEAR/APT -14.5%,
APT/INJ -17.4% — one asset kept diverging and the reversion bet kept paying
for it.

### Why, and the lesson

**Survivorship bias is the most likely explanation.** The 12-pair universe is
today's surviving large-caps. A strategy that systematically longs the
*underperformer* is precisely the one this bias inflates: every asset in that
universe recovered from its drawdowns, because assets that permanently
de-rated are not in the list. Crypto assets do not oscillate around a stable
equilibrium — they trend and re-rate permanently, and the pairs that prove it
are the ones missing from a survivor-selected watchlist.

**Methodological lesson worth keeping:** parameter robustness is necessary but
not sufficient. This result had a clean plateau, a stable time-split, and
outlier-resistance — every within-universe check passed — and was still an
artifact of *which assets were in the universe*. Only an out-of-universe test
exposed it. That test should now be standard before enabling anything.

**Not implemented.** `src/analysis/pairsTrading.js` is kept as the record and
as reusable infrastructure; nothing references it from the live alert path.

## Swing stop vs ATR stop — tested from the parent Quant project, NOT adopted

The desktop Quant app (`src/shared/quant.ts`) defaults to
`stopMethod: 'swing'` rather than the flat ATR\*1.5 this bot uses:
`stop = min(nearestSupport, entry - ATR*0.7)` — a structural stop parked under
the nearest confirmed pivot low, with an ATR\*0.7 floor. Worth testing because
stop width also sets max leverage (`positionSizing.js`), so a tighter stop is
a double win if expectancy holds. `src/analysis/swingStopTest.js`.

Look-ahead hazard handled explicitly: a pivot at bar p is only detectable once
k more bars print, so only pivots satisfying `p + k <= signalIndex` are used.

| method | n | win rate | avgR | avg stop % | max leverage |
|---|---|---|---|---|---|
| ATR\*1.5 (current) | 111 | 63.1% | 0.380 | 7.17% | 6.6x |
| swing, pivot k=3 | 111 | 60.4% | **0.402** | **5.86%** | **8.1x** |
| swing, pivot k=5 | 111 | 64.0% | 0.318 | 9.20% | 5.2x |
| swing, pivot k=8 | 111 | 64.0% | 0.299 | 11.64% | 4.1x |

k=3 is better on both axes — slightly higher avgR *and* a tighter stop
allowing 8.1x instead of 6.6x. But k=5 and k=8 are both worse than ATR, so the
advantage exists at exactly one pivot-window value and the avgR gap (0.402 vs
0.380 on n=111) is well inside noise. **That is the same isolated-cell pattern
used to reject pairs trading, so the same standard applies: not adopted.**
Worth revisiting if a larger sample ever makes k=3 look like a plateau rather
than a point.

## Watchlist change — measured before applying

The scan list was changed to BTC/ETH/SOL/XRP/ZEC/HYPE/DOGE/BNB/ADA/NEAR/AAVE/
ONDO, dropping AVAX, LINK and LTC. Re-running the rare-tier setup on the new
list before trusting it:

| universe | n | win rate | avgR |
|---|---|---|---|
| original 12 | 118 | 67.8% | **0.497** |
| new watchlist | 111 | 63.1% | **0.380** |

Still clearly positive, but ~24% weaker, because the three dropped pairs were
real contributors (LINK 0.481R, LTC 0.211R standalone) while the three added
ones have no validation behind them.

Per-symbol on the new list (ATR stop, confluence filter):

| pair | n | win rate | avgR |
|---|---|---|---|
| BNB | 27 | 77.8% | 0.803 |
| ETH | 17 | 82.4% | 0.756 |
| SOL | 18 | 72.2% | 0.514 |
| BTC | 37 | 45.9% | **-0.060** |
| NEAR | 2 | 50% | -0.114 |
| XRP | 3 | 33.3% | -0.210 |
| AAVE | 2 | 0% | -1.000 |
| ONDO | 2 | 0% | -1.000 |
| ZEC, HYPE | 0 | - | - |

Two things worth internalising:

1. **BTC is the weakest large-sample pair here (-0.06R on n=37)** — the
   aggregate edge is carried by ETH/SOL/BNB. That matters given BTC is the
   pair that tolerates the highest leverage: the temptation is to size up
   exactly where the signal has the least evidence behind it.
2. **ZEC and HYPE produced zero qualifying signals in 2 years** — they are
   recent listings with short history. They are scanned, but contribute
   nothing to this setup yet.

Consequently `crypto/universe.js` now separates two things that were
previously conflated: `DEFAULT_SCAN_UNIVERSE` (what gets scanned) and
`RARE_TIER_UNIVERSE` (what may carry the VERY HIGH badge). NEAR, AAVE and
ONDO are scanned and can produce normal alerts, but cannot trigger the rare
tier until they have evidence. `DEFAULT_VALIDATION_UNIVERSE` is retained so
every number published in this document stays reproducible.

## News backtest — the effect runs opposite to intuition

Google News RSS does serve date-bounded historical queries (`after:`/
`before:`), which was assumed impossible earlier in this project. The initial
HTTP 503s were transient rate limiting, not a block. `src/newsStore.js`
caches every window to disk permanently; `src/analysis/newsBacktest.js` runs
the analysis. Corpus: 416 weekly windows across BTC/BNB/SOL/ETH, ~2 years,
3.7MB committed to `data/news-cache/`.

Volume is z-scored per coin — raw counts are not comparable when Bitcoin
outdraws everything else by an order of magnitude.

### H1 — news volume as a filter on cup-forming: quieter is better

| news intensity | trades | win rate | avgR |
|---|---|---|---|
| all signals (baseline) | 98 | 66.3% | 0.435 |
| **quiet (z < 0)** | 71 | **71.8%** | **0.508** |
| normal (0-1) | 20 | 55.0% | 0.288 |
| busy (1-2) | 7 | 42.9% | 0.103 |
| very busy (z ≥ 2) | 0 | - | - |

Monotonic across every bucket, which is more convincing than a single
standout cell. The reading: cup-forming is a structural setup, and when it
fires amid heavy coverage the move is likely already news-driven and crowded,
swamping the technical edge. Quiet setups are the clean ones.

**Not implemented, and the reason matters.** The effect is directionally
clean but statistically thin: the split is 71 quiet trades versus 27
non-quiet, and a ~0.27R gap at n=27 is roughly one standard error. That is
suggestive, not established. Under this project's own rules that is not
enough to change what gets alerted.

One thing strengthens it, though. 194 of 416 weekly windows hit Google's
~100-item ceiling, so daily counts inside those weeks are undercounted and
some genuinely busy days were classified as normal or quiet. **That
censoring dilutes the measured effect rather than manufacturing it** — the
true gradient is probably steeper than the table shows. (Note the script's
own censoring check reports 0/2772 days at the cap; that is measuring the
wrong level. Capping happens at the weekly fetch, not the daily bucket.)

### H2 — news spike alone: negative, on every coin

| | trades | win rate | avgR |
|---|---|---|---|
| all | 95 | 44.2% | **-0.122** |
| BTC | 15 | 66.7% | -0.037 |
| BNB | 32 | 31.3% | -0.306 |
| SOL | 29 | 41.4% | -0.013 |
| ETH | 19 | 52.6% | -0.045 |

Entering on a coverage spike with no price signal is negative on all four
coins independently. **This directly answers the "trade price action after
news" idea: as a standalone entry trigger it does not work here.** Consistency
across four separate assets makes this the more trustworthy of the two
results, despite the modest total sample.

Taken together the two hypotheses point the same way: news coverage is a
headwind for this setup, not a tailwind. The actionable version is the
opposite of the original idea — prefer quiet setups, be wary of loud ones.

## Known gaps (not done tonight, be aware before trusting this fully)

- No Jaccard/correlation redundancy check for crypto signals (only done for
  stocks) — some of these 4 may still be highly redundant with each other.
- `funding-extreme` (crypto/signals.js) has **no historical backtest at
  all** — OKX has a `funding-rate-history` endpoint that could support one,
  but it wasn't built tonight. Treat that signal as an untested heuristic.
- Universe is only 10 large-cap pairs, 2 years — much smaller than the
  stock validation (91 symbols, 3 years). Altcoin behavior outside these 10
  may differ.
- Backtest ran against OKX price data, not Binance (see okx.js header
  comment) — Binance itself returned HTTP 451 from this environment.
