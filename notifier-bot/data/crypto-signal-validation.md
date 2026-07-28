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
