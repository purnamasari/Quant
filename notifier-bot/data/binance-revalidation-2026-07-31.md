# Binance re-validation — 2026-07-31

Full re-validation of the crypto alert defaults after the OKX → Binance
USDⓈ-M futures data-source swap (commit `1498d6b`). All numbers below are
computed from **Binance fapi** daily candles via `src/crypto/binance.js`
unless noted. Analysis scripts: `/tmp/backtest-cost-split.js`,
`/tmp/backtest-cap-split.js`, `/tmp/rare-tier-revalidation.js`,
`/tmp/regime-split-binance.js`, `/tmp/regime-gated-validation.js`,
`/tmp/event-split-binance.js` (not committed — regenerate from the
methodology below if needed).

## 1. Pooled universe backtest — 12 scan pairs, 730 days, 2-day hold

Same methodology as `npm run backtest:crypto` (walk-forward,
`forwardReturn`, pooled per kind). Universe: BTC/ETH/SOL/XRP/ZEC/HYPE/DOGE/
BNB/ADA/NEAR/AAVE/ONDO USDT.

| kind | trades | WR | avgReturn | expectancy (0%) | expectancy (0.25%) |
|---|---|---|---|---|---|
| ma-alignment | 972 | 52.1% | 1.49% | +1.49% | **+1.24%** |
| near-52w-high | 283 | 50.9% | 1.74% | +1.74% | **+1.49%** |
| volume-surge | 362 | 49.2% | 1.98% | +1.98% | **+1.73%** |
| bos-bullish | 518 | 47.7% | 0.97% | +0.97% | +0.72% |
| golden-cross | 193 | 45.6% | 1.33% | +1.33% | +1.08% |
| vcp | 1296 | 48.5% | 0.33% | +0.33% | +0.08% |
| ob-bullish | 554 | 44.0% | 0.10% | +0.10% | -0.15% |
| macd-bullish | 3735 | 46.7% | 0.16% | +0.16% | -0.09% |
| **cup-forming** | 453 | 51.9% | 0.01% | +0.01% | **-0.24%** |
| rebound | 1211 | 45.7% | -0.12% | -0.12% | -0.37% |
| mean-reversion | 134 | 44.0% | -0.15% | -0.15% | -0.40% |
| momentum | 1403 | 46.3% | -0.06% | -0.06% | -0.31% |
| death-cross | 257 | 49.8% | -0.83% | -0.83% | -1.08% |
| cup-handle | 9 | 33.3% | -2.40% | -2.40% | (tiny) |

OKX baseline (shipped, cost-adj 0.25%): ma-alignment +0.88%, near-52w-high
+0.79%, volume-surge +0.91%, cup-forming +0.44%, bos-bullish +0.52%.

**Direction on Binance:** the three stable kinds improved (1.24–1.73%);
cup-forming went negative; bos-bullish stayed positive but weaker.

## 2. Cap-tier split — 0.25% cost

**BIGCAP** — original 12-pair validation universe
(BTC/ETH/SOL/BNB/XRP/DOGE/ADA/AVAX/LINK/LTC/ZEC/HYPE):

| kind | expectancy | n |
|---|---|---|
| near-52w-high | +1.38% | 287 |
| ma-alignment | +1.33% | 996 |
| volume-surge | +1.13% | 351 |
| bos-bullish | +0.59% | 525 |
| golden-cross | +0.55% | 211 |
| cup-forming | +0.02% | 484 |

**MIDCAP** — NEAR/AAVE/ONDO (scan-only, not in validation universe):

| kind | expectancy | n |
|---|---|---|
| near-52w-high | +4.62% | 26 (thin) |
| volume-surge | +2.54% | 93 |
| ma-alignment | +0.42% | 181 |
| bos-bullish | **-0.38%** | 135 |

## 3. Time-stability split — first vs second 365 days (0.25% cost)

| kind | older half | recent half | verdict |
|---|---|---|---|
| ma-alignment | +1.25% (620) | +1.81% (93) | STABLE |
| near-52w-high | +1.22% (223) | +7.74% (19) | STABLE (thin n) |
| volume-surge | +1.68% (232) | +2.53% (107) | STABLE |
| cup-forming | -0.65% (244) | +0.98% (15) | flip |
| bos-bullish | +1.43% (274) | -0.47% (193) | **flip** |
| golden-cross | +0.86% (97) | -0.92% (62) | flip |

Note the recent half is a structurally different market: BTC cup-forming
fired **0 times** in the last 365 days (ma-alignment: 1 occurrence) — the
recent year is not just quieter, several patterns went extinct.

## 4. Rare tier (cup-forming + confluence ≥2) re-validation

R-multiple sim (ATR×1.5 stop, 1.8R target), RARE_TIER_UNIVERSE (9 bigcap
pairs), Binance vs the shipped OKX claim:

| metric | OKX shipped | Binance |
|---|---|---|
| 7-day hold | 0.497R / 67.8% / n=118 | **0.309R / 59.8% / n=97** |
| 10-day hold | 0.662R / 70.1% / n=97 | **0.431R / 59.8% / n=97** |
| base cup-forming, no confluence (7d) | ~0.087R | 0.039R |

**Stability FAILS:** all 97 trades sit in the older year (2024-08 →
2025-07, bull run); the recent 365 days produced **n=0** occurrences.
The rare tier's edge on Binance is entirely a product of one bull year —
the period-selection trap documented in AGENTS.md.

## 5. Regime split with full independence guards

30 pairs (the `data/export` universe), 730d, 14-day hold R-multiple
(ATR×1.5 stop, 0.25% cost in R terms), regime from BTC via
`src/regime.js` (200SMA position + slope), judged against same-regime
random entries. Guards: n ≥ 30, |t| vs random > 2, ≥ 6 distinct months,
top month share ≤ 40%.

Regime distribution (511 classified days): bull 22.5%, sideways 42.1%,
bear 35.4%. Random baselines: bull -0.247R, sideways +0.001R, bear
-0.015R (bull days in this window were net negative for random 14-day
holds — late-stage bull episodes).

| kind | bull | sideways | bear |
|---|---|---|---|
| ma-alignment | ✅ **PASS** +0.60R, t=2.40, 7mo | ❌ -0.02R | ❌ +0.18R, 5mo |
| near-52w-high | ❌ n=34, t=0.73 | ❌ t=1.90 | ❌ n=24 |
| volume-surge | ❌ t=1.95, topMo 0.38 | ❌ +0.02R | ❌ -0.12R |
| cup-forming | ❌ +0.02R | ❌ t=1.79 | ⚠️ t=3.81, fails 5mo/0.42 |
| bos-bullish | ❌ -0.18R | ✅ **PASS** +0.23R, t=2.65, 9mo | ❌ t=-2.56 (actively harmful) |

Only two cells clear all four guards: **ma-alignment/bull** and
**bos-bullish/sideways**. cup-forming/bear is directionally the strongest
cell anywhere (t=3.81, WR 62%, n=60) but fails the independence guard
(5 distinct months, 42% of trades in one month) — per AGENTS.md this is
exactly the kind of single-episode effect that must stay gated.

## 6. Event / big-move split — 2-day hold, 0.25% cost, vs same-window random

30 pairs, extended history (≈2019-11 → 2026-07, 2450 daily candles from
Binance fapi). Windows deliberately bracket the named episodes
(Covid, bubble, hype, bears). Numbers are edge vs random in the same
window (kind expectancy minus random-entry expectancy), %.

| event | random | ma-align | near-52w | vol-surge | cup-form | bos-bull |
|---|---|---|---|---|---|---|
| COVID crash (2020-02→04, thin) | -3.30 | -3.16 (n=1) | — | +2.97 | -4.22 | +1.89 |
| COVID recovery (2020-05→12) | -1.21 | +1.82 | +2.96 | +1.65 | +2.65 | +1.84 |
| 2021 bubble top (2021-01→11) | -0.16 | +2.57 | **+5.41** | +2.23 | +0.78 | +1.82 |
| 2022 bear LUNA/FTX (2022) | -0.29 | **-2.33** | -3.51 | -1.30 | -0.75 | -0.21 |
| 2023 recovery | +1.88 | -1.11 | -1.19 | -1.04 | -1.73 | -1.48 |
| 2024 ETF+ATH hype | +0.95 | -0.13 | -0.07 | +0.48 | -0.67 | +0.16 |
| 2025 cycle | -0.67 | +0.50 | +1.40 | +1.70 | +0.05 | +0.42 |
| 2026 YTD | -0.88 | +1.09 | +0.18 | +0.87 | +1.03 | +0.52 |

Reading: the signals are bull/hype-phase instruments (2021 bubble top
dominates), actively harmful in the 2022 bear, and add nothing in the
quiet 2023 recovery where random entries outran every signal.
volume-surge is the most phase-resilient kind.

## 7. Policy comparison & decision

2-day hold % metric, 0.25% cost, pooled over 30 pairs × 730d:

| policy | n | expectancy |
|---|---|---|
| A: flat 5 kinds (original) | 3283 | +0.26% |
| B: flat 3 kinds (ma-align/near-52w/vol-surge) | 1694 | +0.55% |
| **C: 3 unconditional + cup/bos regime-gated** | **2100** | **+0.53%** |
| D: 5 flat minus bear | 2417 | +0.41% |
| E: guard-passed cells only (ma/bull + bos/sideways) | 694 | +0.14% |
| RANDOM entry | 4572 | -0.29% |

**Decision (implemented, commit `6d14a4d`):** Policy C. cup-forming and
bos-bullish were briefly dropped on pooled numbers (commit `c392a5c`),
then re-enabled with `config.regimeGates` after the regime-gated
validation showed the pooled averages were cancelling opposite-signed
regime cells. Gates: cup-forming → bear/sideways only; bos-bullish →
sideways only. Near-identical expectancy to flat-3 (+0.53% vs +0.55%)
with 400+ additional trades, and the regime-validated cells are kept.
