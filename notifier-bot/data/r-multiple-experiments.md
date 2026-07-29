# R-multiple experiments (target: find 0.5-1R average expectancy)

`src/analysis/rMultipleBacktest.js` simulates the actual stop/target
(ATR*1.5 stop, configurable R:R target) day-by-day, matching what
`risk.js`'s `riskPlanFor` proposes on a live alert — a stricter bar than
the raw % return numbers in `data/stock-signal-validation.md` /
`data/crypto-signal-validation.md`.

## Baseline (2-day hold, 1.8 R:R — the bot's default everywhere else)

| kind | avg R | stopped out | target hit |
|---|---|---|---|
| Stock: momentum/cup-forming/golden-cross/ob-bullish | 0.048-0.062R | 12-14% | 2-2.5% |
| Crypto: ma-alignment/near-52w-high/volume-surge/cup-forming | 0.067-0.087R | 9-17% | 2.5-10.9% |
| Crypto: bos-bullish | 0.12R (best) | 7.5% | 8% |

**Why so low:** target-hit rate is only 2-11% — 83-90% of trades never
reach either stop or target within 2 days, they just time-exit near
breakeven, dragging the average toward zero. 2 days is short relative to
an ATR*1.5/2.7 stop/target distance.

## Experiment 1: extend hold to 5 / 10 days

Avg R rises steadily with more time to actually reach stop/target:

| kind | 2d | 5d | 10d |
|---|---|---|---|
| Stock momentum | 0.048 | 0.094 | 0.121 |
| Stock cup-forming | 0.051 | 0.109 | 0.151 |
| Stock golden-cross | 0.062 | 0.127 | 0.177 |
| Stock ob-bullish | 0.058 | 0.103 | 0.155 |
| Crypto ma-alignment | 0.07 | 0.09 | 0.082 |
| Crypto near-52w-high | 0.067 | 0.071 | 0.04 |
| Crypto volume-surge | 0.086 | 0.106 | 0.149 |
| **Crypto cup-forming** | 0.087 | 0.144 | **0.286** |
| Crypto bos-bullish | 0.12 | 0.074 | 0.058 |

Crypto cup-forming stands out — keeps improving all the way to 10 days
(unlike near-52w-high/bos-bullish which plateau or decline). Still short
of 0.5R alone.

## Experiment 2: tighten target to 1:1 R:R (2-day hold)

No real improvement (0.041-0.099R across both markets) — mathematically
a wash: target-hit rate roughly doubles-to-quintuples, but each win pays
out less (1.0R instead of 1.8R), and the two effects largely cancel.

## Experiment 3: require confluence (2+ signals same day)

**Stock: flat, no effect** (0.046-0.062R regardless of confluence
1/2/3+) — consistent with the earlier finding that confluence doesn't
add edge for stocks.

**Crypto: confluence clearly helps**, unlike stocks:

| kind | confluence=1 | confluence=2 | confluence=3 |
|---|---|---|---|
| ma-alignment | 0.07 | 0.147 | 0.125 (n=101) |
| near-52w-high | 0.067 | 0.088 | 0.126 (n=83) |
| volume-surge | 0.086 | 0.11 | 0.159 (n=62) |
| **cup-forming** | 0.087 | **0.244** | 0.082 (n=27, noisy — sample too thin) |
| bos-bullish | 0.12 | 0.186 | **0.267** (n=74) |

## Combined: confluence (2+) + extended hold — this is where it clicks

Tested cup-forming/bos-bullish/ma-alignment together at confluence>=2
across hold 5d and 10d:

| kind | 5d | 10d |
|---|---|---|
| **cup-forming** | 0.366 (n=97) | **0.662 (n=97, win rate 70.1%)** |
| ma-alignment | 0.33 (n=161) | 0.476 (n=161) |
| bos-bullish | 0.253 (n=114) | 0.309 (n=114) |

**Crypto `cup-forming`, confluent with any other validated crypto signal
same day, held 10 days: reaches the 0.5-1R target.** Stability-checked by
splitting into two ~1-year periods:

| period | trades | win rate | avg R |
|---|---|---|---|
| year 1 | 75 | 70.7% | 0.733R |
| year 2 | 43 | 62.8% | 0.459R |

Both periods clear or nearly clear 0.5R — this isn't a single lucky
stretch. confluence>=3 (n=8) was NOT trusted despite looking even better
(0.442R) — at that filter level all three kinds returned identical stats
because they're literally the same 8 overlapping occurrence-days, not an
independent sample.

## Important caveat before using this

This is a **10-day hold**, not the 1-2 day swing this whole bot is built
around — it's closer to a position trade than a quick swing. Using it
would mean adding a genuinely separate alert category/tier (different
hold period, different messaging about time horizon), not a tweak to the
existing 2-day alerts. Not yet implemented — cost-adjustment in R-terms
and identifying which specific signal(s) most often pair with cup-forming
in the qualifying confluence set are still open before this should ship.
