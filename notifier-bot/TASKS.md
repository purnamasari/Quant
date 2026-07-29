# Tasks — execution bot

Breakdown of `TRADING_BOT_PLAN.md`. Read that first, especially §1 (what is not
realistic) and §2 (the safety model), because several tasks here only make sense
in light of them.

Each task states what "done" means. A task is not done because code exists — it
is done when the stated check passes.

---

## Phase 0 — groundwork (no money, no orders)

- [ ] **0.1 Confirm Binance reachability from the VPS.**
      `curl "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=2"`.
      Done: returns candle data. If it returns 451, stop — the whole plan
      assumes Binance access, and OKX has no futures access for this account.
      Do not attempt to route around a geographic block.
- [ ] **0.2 Create testnet API keys** (testnet.binancefuture.com).
      Done: keys stored in `.env`, never committed, and a read-only call
      succeeds.
- [ ] **0.3 Create live API keys with trade-only permission and IP whitelist.**
      Done: withdrawal is disabled and verified disabled; key is bound to the
      VPS IP. Store but do not use until phase 4.
- [ ] **0.4 Compare Binance vs OKX candles for the 12 pairs.**
      Done: a table of close differences. Expect small gaps from differing
      candle conventions. If they are large, the backtest numbers do not
      transfer and validation must be re-run on Binance data before going live.

## Phase 1 — Python core (signals in, decisions out, no orders)

- [ ] **1.1 Project skeleton.** FastAPI, SQLite (Postgres later), pydantic
      settings, structured logging. Done: `/health` responds; config loads from
      env with no secrets in code.
- [ ] **1.2 Schema.** `signals`, `decisions`, `orders`, `positions`, `trades`,
      `journal_entries`, `risk_events`. Every row carries the reasoning that
      produced it. Done: migrations run clean from empty.
- [ ] **1.3 Signal intake from the JS scanner.** JS writes to an endpoint or
      shared table; Python validates and stores. Done: a real `cryptoJob.js`
      run appears as rows, with a rejected malformed payload logged not
      crashed.
- [ ] **1.4 Port `positionSizing.js`.** Leverage derived from stop width,
      liquidation ≥2x stop distance, 15x hard cap, funding warning.
      Done: unit tests reproduce the worked examples in
      `data/risk-management-plan.md` (BTC 3.88% stop → 12x; SOL 9.57% → 4x).
- [ ] **1.5 Port `protections.js` + add the new rules.** Cooldown, anti-revenge,
      stoploss guard, max margin per trade, max total margin, max concurrent,
      daily loss limit. Done: a table-driven test covers each rule firing and
      each rule *not* firing, including the boundary.
- [ ] **1.6 Risk gate.** Given a signal, return approve/reject with a reason
      and a full position plan. Done: every rejection has a machine-readable
      reason code; no path returns a bare `false`.
- [ ] **1.7 Journal writer.** Every decision recorded whether or not it becomes
      a trade — including rejections. Done: replaying a day of signals produces
      a complete audit trail with no gaps.

## Phase 2 — Telegram approval (paper only)

- [ ] **2.1 Bot skeleton in Python** (python-telegram-bot or raw API).
      Done: sends a formatted alert matching the current JS format.
- [ ] **2.2 Approve/reject buttons with callbacks.** Done: a tap updates the
      decision row and edits the message so the state is visible in the chat.
- [ ] **2.3 Approval expiry — 15 minutes.** Done: a tap after expiry is
      rejected with an explanatory message; verified by a test that
      manipulates the clock, not by waiting.
- [ ] **2.4 Paper execution.** Simulated fills at the alert price, positions
      tracked, stops and the 14-day exit applied. Done: a paper trade opens,
      hits its stop, and closes with the correct R recorded.
- [ ] **2.5 Kill switch command.** Done: `/halt` blocks all new approvals and
      is visible in the next alert.

## Phase 3 — testnet execution

- [ ] **3.1 ccxt Binance futures client.** Done: fetches balance and positions
      from testnet.
- [ ] **3.2 Idempotent order placement.** `clientOrderId` derived
      deterministically from the signal id. Done: submitting the same order
      twice results in **one** position — test it explicitly, this is the most
      common way bots double their size.
- [ ] **3.3 Exchange-side stop orders.** The stop lives at Binance, not in bot
      memory. Done: kill the bot process with a position open and confirm the
      stop is still active on the exchange.
- [ ] **3.4 Reconciliation on startup.** Compare exchange positions with the
      local DB; on mismatch, trust the exchange and log a `risk_event`.
      Done: manually open a position outside the bot and confirm it is adopted
      or flagged, never ignored.
- [ ] **3.5 Position monitor.** Track open positions, apply the 14-day time
      exit, record fills. Done: a full testnet trade completes end to end and
      the recorded R matches a hand calculation.
- [ ] **3.6 Failure drills.** Kill mid-order; disconnect the network; restart
      with positions open; duplicate webhook. Done: each drill has a written
      expected-vs-actual result. **Do not proceed to phase 4 until all pass.**

## Phase 4 — live, minimum size

- [ ] **4.1 Switch to live keys, caps at minimum.** One pair, smallest
      permitted notional, max 1 concurrent position, leverage cap 5x.
      Done: one live trade completes.
- [ ] **4.2 Daily reconciliation report** to Telegram: positions, balance,
      discrepancies. Done: arrives daily and has caught at least one seeded
      discrepancy in testing.
- [ ] **4.3 Raise caps gradually**, only after 10+ live trades with no
      execution defects. Done: a written review comparing live R against the
      0.949R backtest expectation.

## Phase 5 — Telegram Web App

- [ ] **5.1 Web App skeleton** served by FastAPI, authenticated via Telegram
      `initData` HMAC. Done: rejects a forged payload.
- [ ] **5.2 Performance dashboard.** Equity curve, R distribution, win rate,
      avg hold, live-vs-backtest comparison. Done: numbers reconcile with the
      trades table.
- [ ] **5.3 Trade journal UI.** Per trade: chart at entry, the plan, what
      happened, free-text notes, structured prompts (did you follow the plan,
      did you close early, why).
- [ ] **5.4 Adherence report.** Deterministic: planned versus actual entry,
      exit, size, hold. Done: flags every deviation without an LLM involved.

## Phase 6 — LLM journal assistant

- [ ] **6.1 Weekly summary** over deterministic metrics — describing, not
      judging. Done: output contains no claim that is not derivable from the
      metrics it was given.
- [ ] **6.2 Pattern surfacing across journal entries**, explicitly framed as
      hypotheses to test, never as conclusions. Done: every output states the
      sample size it is based on.
- [ ] **6.3 Guardrail.** The assistant must never recommend taking or skipping
      a trade. Done: a prompt-injection test confirms it refuses.

---

## Deliberately not on this list

See `TRADING_BOT_PLAN.md` §5. In short: full automation without approval, ML
feature pipelines, porting the signal engine early, adding more signal kinds,
and automating the stock side.

## Ordering note

Phases 0-3 are reversible; phase 4 is not. The failure drills in 3.6 are the
gate, and they are the tasks most likely to feel skippable when everything
appears to work. Every real bug in this project so far — look-ahead bias, a
4-hour timezone error, a dedup key that silently re-fired, a data outage that
printed the same summary as a quiet market — looked like everything was working
right up until it was checked.
