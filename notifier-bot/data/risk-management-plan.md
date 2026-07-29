# Leveraged swing trading — system design

Design target: sustainable, positive-expectancy, a few trades per week,
using 10-100x leverage on perps as originally requested. Everything below is
derived from backtests in this repo, not from general trading advice. Two
scripts produce the numbers: `src/analysis/leverageRisk.js` and
`src/analysis/fundingCost.js`.

## 1. The finding that shapes everything: leverage destroys the edge before it bankrupts you

All 118 historical `cup-forming` + confluence trades (the validated setup,
0.497R baseline) replayed at each leverage. `avgR` stays in the original R
units — 1R = the ATR\*1.5 stop — so every row is directly comparable:

| leverage | avgR | win rate | liquidated | return on margin / trade |
|---|---|---|---|---|
| 1-5x | **0.497** | 67.8% | 0% | 3.5% - 17.7% |
| 10x | **0.495** | 67.8% | 4.2% | 35.3% |
| 15x | 0.463 | 64.4% | 12.7% | 49.5% |
| 20x | 0.439 | 60.2% | 18.6% | 62.7% |
| 30x | 0.304 | 47.5% | 50.0% | 65.2% |
| 50x | 0.133 | 28.8% | 71.2% | 47.4% |
| 100x | **0.096** | 16.9% | **83.1%** | 68.2% |

The mechanism is not "losses get bigger". With isolated margin at leverage L
the exchange liquidates at roughly a `1/L` adverse move. Once that sits
**inside** the ATR\*1.5 stop, liquidation quietly replaces the stop the edge
was measured against, and ordinary noise starts closing trades that would
have won. At 100x the win rate collapses from 67.8% to 16.9% — the setups are
identical, the exits are not.

Why the setups need room, from the same run — Maximum Adverse Excursion of
**winning** trades (how far they dip before working):

| p25 | p50 | p75 | p90 | p95 |
|---|---|---|---|---|
| 0.166R | 0.263R | 0.448R | 0.697R | 0.837R |

A quarter of eventual winners dip past 0.45R first. Any leverage whose
liquidation lands inside ~0.85R will systematically harvest winners as losses.

Note the `return on margin` column keeps rising while the edge collapses —
that is the trap. 100x shows 68.2% per trade *and* an 83% liquidation rate:
it is a lottery ticket whose sequence risk (0.83^5 = a 39% chance of five
straight total-margin losses) wipes an account long before the average
arrives.

## 2. Your instinct about BTC vs altcoins is correct — here is the number

Higher leverage on BTC is right, because BTC's stop is *narrower in percentage
terms*, so liquidation can sit further away in stop-multiples. Median ATR\*1.5
stop width at signal time, and the leverage at which liquidation would land
exactly on the stop:

| pair | stop width at signal | liq-lands-on-stop |
|---|---|---|
| BTC-USDT | 3.88% | 24.5x |
| BNB-USDT | 7.88% | 12.1x |
| LTC-USDT | 8.57% | 11.1x |
| ADA-USDT | 8.71% | 10.9x |
| ETH-USDT | 8.83% | 10.8x |
| SOL-USDT | 9.57% | 9.9x |
| AVAX-USDT | 9.70% | 9.8x |
| DOGE-USDT | 10.19% | 9.3x |
| LINK-USDT | 12.42% | 7.6x |
| XRP-USDT | 13.41% | 7.1x |

Those are the leverages at which liquidation and stop *coincide* — i.e. zero
margin for error. The system halves them (see below). So BTC ~12x, most
altcoins ~4-5x. The 2.5x ratio between BTC and alts matches the intuition;
the absolute level of 100x does not survive contact with the data.

Stop width is measured **per trade, live** (`riskPlanFor` → `positionPlan`),
not read from this table — volatility changes, and cup-forming fires after a
run-up when ATR is already elevated (note every "at signal" number above is
wider than the same pair's current ATR).

## 3. Sizing rule: leverage is an output, never an input

The rule that makes leverage survivable:

```
risk amount = account x RISK_PERCENT          (default 1%)
notional    = risk amount / stop distance %
max leverage = 0.95 / (stop distance % x 2)    liquidation >= 2x stop away
margin      = notional / leverage
```

Choose how much to *risk*; the stop width sets the position; leverage is only
how much margin is posted to hold it. Sizing by "I'll use 50x" inverts this
and is the actual failure mode.

Worked example, $10,000 account, 1% risk (`src/positionSizing.js`):

| | BTC (stop 3.88%) | SOL (stop 9.57%) |
|---|---|---|
| risk if stopped | $100 | $100 |
| notional | $2,577 | $1,045 |
| leverage | 12x | 4x |
| margin posted | $215 (2.15% of account) | $261 (2.61%) |
| liquidation at | -7.92% (2.04x stop) | -23.75% (2.48x stop) |

Both trades risk exactly $100. Leverage differs by 3x purely because the stops
differ. Margin posted is ~2.5% of the account either way — that is what
leverage genuinely buys: capital efficiency, not extra risk.

Hard cap is 15x (`MAX_LEVERAGE_HARD_CAP`) even where the math allows more,
because 20x already gives up 12% of the edge on a benign 2-year sample.

## 4. Funding cost — measured, small now, but capable of erasing the edge

Funding is charged on notional and 1R is also a fixed % of notional, so
`funding cost in R = funding % over hold / stop %` — **independent of
leverage**. Real OKX data, 7-day rolling cost for a long:

| pair | median 7-day cost | worst observed | worst in R |
|---|---|---|---|
| BTC-USDT | 0.067% | 0.145% | 0.037R |
| ETH-USDT | 0.044% | 0.161% | 0.018R |
| SOL-USDT | 0.024% | 0.130% | 0.014R |
| others | 0.03-0.10% | 0.15-0.19% | 0.01-0.02R |

Over this window funding never exceeded 0.04R — under 8% of the edge, a
non-issue. **Caveat: OKX only retains ~92 days of funding history** (verified
— pagination works, the data simply ends), so this window contains no
euphoric bull phase, which is exactly when funding spikes.

The tail case is real: sustained 0.1%/8h funding (common in late-stage rallies)
costs 2.1% over 7 days, which on BTC's 3.88% stop is **0.54R — larger than the
entire 0.497R edge**. Note the asymmetry: BTC's tight stop is what permits the
highest leverage *and* what makes it most vulnerable to funding drag, since the
same funding % is divided by a smaller number.

`positionSizing.js` therefore checks live funding on every alert and warns when
the projected 7-day cost exceeds 0.15R. That also finally puts the
`funding-extreme` detector to legitimate use — not as an entry signal (never
validated as one) but as a **carry-cost filter**.

## 5. Correlation is the hidden position-size multiplier

Every crypto long in this system is substantially the same bet on BTC
direction (majors correlate 0.7-0.9). Three simultaneous 1%-risk longs is
close to a 3% single bet, not a diversified 1%. `MAX_CONCURRENT_POSITIONS`
defaults to 3, i.e. 3% total account heat.

This is also why pairs trading was proposed as the side strategy: it is the
one candidate whose alpha does not come from the same beta-to-BTC factor
everything else here shares.

## 6. News and scheduled events

Trading price action *after* news is reasonable but sits outside what can be
validated here: there is no historical news archive to backtest against, so a
"news reaction" signal could never earn a conviction tier the way the others
did. What is testable and already built is the guardrail:

- The macro H-1 ping (`src/macroPing.js`) already flags CPI/FOMC/NFP one hour
  ahead with directional scenarios.
- A 7-day hold *will* span scheduled events. At 12x, a 4% instant wick against
  the position is half the margin — and event wicks routinely exceed the
  average daily range.
- Rule: do not open a new leveraged position inside the H-1 window; if a
  high-impact event falls mid-hold, either halve leverage beforehand or accept
  it deliberately.

Not yet built, and the honest next step for the news idea: backtest whether
entries in the 24h *after* a major macro release behave differently from
baseline. That needs a historical macro calendar; the Nasdaq endpoint used by
`macro.js` may support it.

## 7. Circuit breakers

Backtested expectancy assumes the strategy is still being followed. These are
what keep a losing streak from turning into abandonment or revenge sizing:

- **Max 3 concurrent positions** (correlation, above).
- **Stop for the week after -5% account** (5 consecutive full stop-outs at 1%
  risk). At 67.8% win rate a 5-loss streak has ~0.3% probability per 5 trades —
  rare enough that hitting it is genuine evidence something has changed.
- **Never move a stop away from entry.** The 0.497R edge is measured with the
  stop honoured; widening it invalidates every number in this document.
- **Do not add to a losing position.** Nothing in the backtest averages down.

## 8. What is intentionally not in this system

- **Scalping** — excluded by the user's own history, and every intraday
  variant tested here (1m/5m/15m entry refinement, the 4H-15m-5m cascade)
  produced negative expectancy.
- **Wider coin universe** — tested, the edge does not survive on mid-caps
  (0.095R vs 0.497R).
- **More signal kinds** — tested all 15; the next best is under half as good.
- **ML / RL / genetic strategies** — sample sizes here are in the hundreds;
  those methods would fit noise.

## Summary

| | |
|---|---|
| Primary setup | cup-forming + confluence, 7-day hold, 0.497R, ~1 per 6-10 days |
| Side strategy | pairs trading (candidate — not yet validated) |
| Leverage | derived per trade; BTC ~12x, alts ~4-5x; hard cap 15x |
| Risk per trade | 1% of account |
| Max concurrent | 3 positions (3% total heat) |
| Funding guard | warn above 0.15R projected cost |
| Weekly stop | -5% account |
