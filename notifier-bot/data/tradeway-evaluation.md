# ashcel/tradeway — backtest evaluation

The user's own signal bot, never backtested by them ("aku belum sempet backtest
sih"). The question was narrow: is there an engine or strategy in here worth
reusing in notifier-bot?

Run with tradeway's OWN backtest harness (`src/backtest/run.ts`), not a
reimplementation — its fill model, its cost assumptions, its gates. A port would
have measured my reading of the strategies rather than the strategies.

## Setup

- 30 days, 5 symbols (BTCUSDT, ETHUSDT, SOLUSDT, ZECUSDT, HYPEUSDT — the
  `enabled: true` set in `config/watchlist.yaml`)
- 15-minute evaluation step, 30-day warm-up for the engine strategies
- Costs as the repo defines them: 0.11% round-trip fee + 0.02%/side slippage
- SL-first on ambiguous bars (pessimistic — the harness already does this)

## Results

| strategy | signals | fill % | win % | exp. R | PF | total R |
|---|---|---|---|---|---|---|
| H18 | 11 | 100% | 18.2% | **-0.70** | 0.06 | -7.66 |
| SMC | 8 | 62.5% | 0% | **-1.17** | 0.00 | -5.85 |
| SMC_SCALP | 4 | 100% | 33.3% | **-0.42** | 0.48 | -1.27 |
| legacy · momentum | 9 | 100% | 33.3% | **-0.27** | 0.59 | -2.44 |
| legacy · trend_pullback | 4 | **0%** | — | — | — | — |

All negative. **This is not a verdict on the strategies** — n=4 to 11 is far too
small for one. A single trade moves the mean by roughly 0.3R at these counts.

## The finding that actually matters: signal rate

The gate funnels explain why the samples are so thin, and this is structural
rather than a tuning problem:

```
H18        evaluated=13234  ->  12 signals    channel gate passes 0.6% of evals
SMC        evaluated=14230  ->   8 signals    fvg     gate passes 0.1% of evals
SMC_SCALP  evaluated=11445  ->   4 signals    rr      gate passes 0.0% of evals
```

Five symbols over a month produce ~10 setups. A strategy firing that rarely
needs **years** of history before its expectancy means anything — the same
constraint that killed the 4H-FVG -> 5m-FVG cascade (see
data/crypto-signal-validation.md). So the honest read is: no evidence of edge,
and this repo cannot be validated on a reasonable timescale without a much
longer history run. Nothing here is portable into notifier-bot yet.

For scale: notifier-bot's own rare tier fires ~118 times over 730 days on 12
pairs, which is already thin enough that its 0.949R carries a "read as 0.7-1.1R"
caveat. tradeway's strategies are an order of magnitude rarer than that.

## trend_pullback never fills

4 signals, **0% fill** — price never touched the entry band at all. That is not
a losing strategy, it is an unused one. Worth looking at before anything else in
the repo, because it is a bug-shaped result rather than a performance result:
either the band is too narrow or it is placed on the wrong side of the setup.

## Method caveat: OKX standing in for Bybit

`api.bybit.com` answers HTTP 403 from this container's egress jurisdiction, the
same block Binance applies. `okx-shim.mjs` (in the tradeway clone, not committed
here) patches global fetch and serves Bybit's `/v5/market/kline`,
`/v5/market/funding/history` and `/v5/market/open-interest` from OKX in Bybit's
response shape, so nothing in tradeway's `src/` had to change.

Two things to know before trusting a re-run:

- **Klines and funding are equivalent.** OKX has direct counterparts. The one
  subtlety is paging: tradeway stops paginating when a page returns fewer than
  1000 rows, while OKX caps at 100, so the shim pages OKX internally and only
  answers once the requested limit is satisfied. A naive 1:1 proxy would have
  returned 100 rows and the caller would have concluded it had reached the start
  of history after one page.
- **Open interest is NOT apple-to-apple.** OKX only serves a historical OI
  series per *currency* in USD (`rubik/stat/contracts/open-interest-volume`),
  where Bybit serves it per *contract*. Harmless here only because every
  consumer in tradeway reads OI as a change, not a level. Re-running against real
  Bybit from the VPS may shift the regime-gate counts.

## Not evaluated: ashcel/market-pulse

Private repo, and this session is scoped to the `purnamasari` owner, so it could
not be added. Untested, not "tested and rejected".
