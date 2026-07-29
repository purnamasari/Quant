# Execution bot — design and honest assessment

Requested: a bot that executes on Binance after Telegram approval, with
protections (anti-revenge, cooldown, margin caps), a Telegram Web App for
performance monitoring and journaling, and an AI trade reviewer — Python
backend so it can later be trained into an ML model.

Most of this is realistic. Two parts of it are not, and one carries a risk
category this project has never touched. Those come first, because they change
what is worth building.

---

## 1. What is not realistic, and why

### The ML goal will not be reachable for years

The stated reason for Python is "so it can be trained into an ML model". The
language choice is fine. The ML goal is not, and the blocker is not tooling —
it is data.

The validated setup produces **roughly one signal every 6-10 days**. The entire
backtest is 118 trades over two years. Live, you will accumulate:

| after | trades |
|---|---|
| 1 month | 3-5 |
| 6 months | 18-30 |
| 2 years | ~70-120 |

A model with even ten features needs hundreds to thousands of examples before
it learns anything that is not noise. At this rate that is **five to ten years
of live trading**. This is the same reasoning that rejected ML, RL and genetic
strategies earlier in the project, and nothing about rewriting in Python
changes it.

What Python *is* genuinely worth having for: pandas and scipy make the
statistical work (t-tests, split-half, bootstrap) far less painful than the
hand-rolled JS in `src/analysis/`. That is a real benefit today. "ML-ready" is
not — and building for it now means designing around a constraint that will not
bind for years.

**Recommendation:** build in Python because the analysis tooling is better, not
because of ML. Store every trade with full context so that if the data ever
does accumulate, nothing is missing. Do not build feature pipelines or model
scaffolding now.

### The "AI trade reviewer" is a journaling aid, not an advisor

An LLM reviewing your trades will produce fluent, confident, plausible
narrative. With 3-5 trades a month it cannot do anything statistically valid —
any pattern it "finds" in five trades is storytelling. Worse, it will sound
equally confident whether it is right or not, which is precisely the failure
mode this project has spent its whole life avoiding.

Where it is genuinely useful:

- **Structured journaling prompts** — did you follow the plan, did you close
  early, what did you feel. Answering those consistently is what produced your
  own useful self-diagnosis ("bad MM, closed too early"), and that diagnosis
  turned out to be worth 0.5R per trade.
- **Rule-adherence checking** — comparing what the plan said against what you
  actually did. That is deterministic and does not need an LLM's judgement,
  only its ability to summarise.
- **Surfacing your own past notes** at the moment a similar setup appears.

Where it must not be used: deciding whether to take a trade, or concluding that
a strategy is working. Those need the statistics, not the narrative.

**Recommendation:** build it as "journal + adherence report", with the LLM
writing summaries over deterministic metrics. Not as an advisor.

---

## 2. The risk that changes everything: this handles real money

Every bug so far has been survivable. A wrong signal was a suggestion you could
ignore; a wrong macro time was a mistimed notification. The moment the bot holds
API keys, the same class of bug becomes **an unwanted position at 12x
leverage**, and this project has already produced several genuine bugs —
look-ahead bias, a timezone error of 4-5 hours, a dedup key that silently
re-fired, a suppressed-vs-quiet failure mode that looked identical to success.

That history is not an argument against building it. It is an argument for the
safety model below being non-negotiable rather than a later phase.

### Non-negotiable safety requirements

1. **API keys: trade permission only.** Never enable withdrawal. Bind the key
   to the VPS IP. If the key leaks, the worst case must be bad trades, not
   drained funds.
2. **Testnet first, for a full cycle.** Binance testnet until the bot has
   opened, held, and closed positions correctly through every path including
   stop-outs and restarts.
3. **Idempotency.** Every order carries a client-generated ID derived from the
   signal, so a retry after a network failure cannot open a second position.
   This is the single most common way naive bots double their size.
4. **Reconciliation on every start.** On boot, ask the exchange what positions
   actually exist and compare with the local database. Never assume the local
   view is correct after a crash.
5. **Crash-safe stops.** Stops live **on the exchange**, not in bot memory. If
   the process dies, the position is still protected.
6. **A kill switch** that closes everything and halts, reachable from Telegram
   without a working backend loop.
7. **Hard caps enforced server-side in the bot**, not merely displayed:
   max leverage, max margin per trade, max total margin, max concurrent
   positions, daily loss limit.

### The approval flow is a safety feature, not a UI choice

You asked for click-to-approve rather than full automation. That is the right
call and worth stating why: it keeps a human in the loop for the decision while
removing the human from *execution* — where the errors were (bad sizing,
closing early). It also means a signal-generation bug cannot silently trade.

Approval must expire. A button tapped six hours later is approving a setup that
no longer exists. **15 minutes**, then the alert is dead and must re-fire.

---

## 3. Architecture

Four services, deliberately separable so a failure in one cannot trade.

```
  signal engine (existing JS, unchanged)
        │  emits validated signals
        ▼
  ┌─────────────────┐
  │  core (Python)  │  FastAPI + SQLite/Postgres
  │  - risk gate    │  protections, sizing, caps
  │  - order mgr    │  idempotent, reconciles
  │  - journal      │  every decision recorded
  └────────┬────────┘
     │            │
     ▼            ▼
  Binance      Telegram bot
  (ccxt)       - approve / reject buttons
               - Web App (monitoring, journal)
```

### Why the JS signal engine stays

`src/stock/signals.js`, `src/smc.js` and the backtest engine are the only
heavily-validated code in this project — a 0.949R edge measured against random
entries at t=5.39. Rewriting them in Python risks silently breaking the one
thing that is proven, and a subtle porting bug would look exactly like a
strategy that stopped working.

If they are ported later, the port must ship with a **parity test**: run both
implementations over the same 2 years of candles and assert identical signal
dates for all 12 pairs. Without that test, the port is a rewrite of unvalidated
code wearing validated code's numbers.

The clean seam: the JS scanner writes signals to the database (or an HTTP
endpoint); Python owns everything downstream.

### Risk gate — the protections, enforced

Ported from `src/protections.js` plus what you asked for:

| protection | rule | why |
|---|---|---|
| cooldown | no re-entry on a pair for 72h after it stops out | the urge to re-enter is strongest when judgement is worst |
| anti-revenge | no *manual* override within 2h of a stop-out | the specific failure you named |
| stoploss guard | 3 stops in 7 days pauses everything 48h | a cluster means the regime changed |
| max leverage | derived per trade from stop width, hard cap 15x | measured: above ~15x liquidation sits inside the stop |
| max margin/trade | configurable, default 5% of equity | |
| max total margin | default 15% | crypto longs correlate 0.7-0.9; 3 positions is ~3x one bet |
| max concurrent | 3 | same reason |
| daily loss limit | -5% halts the day | |
| auto-reject | any signal failing any check is rejected with a logged reason | a silently withheld signal is indistinguishable from no signal |

"Auto margin" as requested = leverage and margin derived from the stop width
rather than chosen — already implemented in `src/positionSizing.js` and ported
directly.

---

## 4. Phasing

Ordered so that nothing touches real money until everything around it is
proven. Each phase is independently useful if you stop there.

| phase | delivers | real money? |
|---|---|---|
| 0 | Binance reachability + testnet keys | no |
| 1 | Python core: DB, risk gate, journal. Signals in, decisions out, no orders | no |
| 2 | Telegram approve/reject with expiry; paper trades only | no |
| 3 | Testnet execution: idempotency, reconciliation, exchange-side stops | no |
| 4 | Live, minimum size, one pair, caps at their lowest | **yes, small** |
| 5 | Web App: performance, journal, adherence | yes |
| 6 | LLM journal summaries | yes |

Phase 4 is where the project changes character. Everything before it is
reversible; that is not.

---

## 5. What I recommend against building

- **Full automation without approval.** The measured edge assumes the setup as
  specified; unattended execution multiplies the cost of any signal bug.
- **ML features or model scaffolding now.** See §1.
- **Porting the signal engine early.** See §3.
- **More signals.** Fifteen kinds were swept; the next best is under half as
  good. Effort is better spent on execution quality, which is where the last
  0.5R came from.
- **Trading the stock side automatically.** Stock signals are far weaker
  (0.02-0.11% cost-adjusted) and the crypto edge is the one worth executing.

---

## 6. Honest overall assessment

**Realistic:** the execution bot, the protections, the Telegram approval flow,
the Web App, and the journal. This is ordinary engineering — several weeks of
focused work, not research. The hard part is discipline in the safety model,
not difficulty.

**Not realistic:** ML on this data volume, for years. And an AI reviewer that
gives strategy advice rather than journaling structure.

**The thing to watch:** the edge being executed is one setup, ~1 signal per
6-10 days, measured at 0.949R. That is genuinely good — it beat random entries
at t=5.39 and survived out-of-universe — but it is *one* edge measured over
*two years* in a market that mostly rose. The bot should be built so that
discovering the edge has decayed is easy and cheap, because that is a normal
outcome rather than a remote one. Live-versus-backtest tracking (ROADMAP item
5) matters more once real money is involved, not less.
