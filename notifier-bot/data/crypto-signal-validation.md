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
