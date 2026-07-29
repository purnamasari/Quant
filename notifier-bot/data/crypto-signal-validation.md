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
