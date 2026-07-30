# What would actually make this more profitable

Ranked by expected value per unit of work, using only numbers measured in this
repo. Each item says what it is worth, what would falsify it, and what it costs.

The honest starting point: **one setup carries this system.** The rare tier
(cup-forming + confluence, bigcap only) returns 0.911R against a 0.226R random
baseline — an edge of +0.685R on n=102, firing once every 6-10 days. Almost
everything else in the 30-row scoreboard is within noise of random once the
correct baseline is used. So the question is not "what new signal can we add",
it is "how do we extract more from the one thing that works, and how do we find
a second one honestly".

---

## 1. Position sizing by measured edge (highest value, no new edge required)

Today every alert risks the same 1% regardless of whether it is the 0.911R rare
tier or a 0.101R ma-alignment. That is leaving money on the table at the top and
paying for noise at the bottom.

`data/strategy-stats.json` now carries per-strategy expectancy, win rate and
realized RR — everything fractional Kelly needs. Sizing risk proportional to
edge (capped, quarter-Kelly at most) mechanically raises return without raising
ruin risk, because it moves capital from the rows that barely beat random to the
one that clearly does.

- **Worth:** the rare tier is ~4.5x the edge of the median enabled kind. Sizing
  it 2x while halving the weakest kinds is a large change in expected return
  from zero new signal research.
- **Falsified by:** per-strategy expectancy being unstable out-of-sample. Check
  by re-running the scoreboard on a later window and confirming the ranking
  order holds, not just the signs.
- **Cost:** small — `positionSizing.js` already computes everything else.
- **Risk to respect:** Kelly assumes the edge estimate is right. n=102 is thin,
  so cap at quarter-Kelly and never let sizing exceed the existing leverage
  invariant.

## 2. Cut transaction cost (direct, immediate, unglamorous)

Every figure here assumes 0.25% round trip. For the rare tier that is a small
tax on 0.911R. For the midcap kinds it is most of the edge: volume-surge midcap
returns 0.218R, and the cost assumption inside that is roughly 0.08-0.12R
depending on stop width.

Moving from market to limit/maker entries on a setup with a 14-day hold — where
being filled ten minutes later costs almost nothing — plausibly halves it.

- **Worth:** ~0.05-0.10R on every midcap trade. On thin edges that is the
  difference between real and not.
- **Falsified by:** measuring actual fill rates and finding limit orders miss
  the move often enough to cost more than the fee saved.
- **Cost:** small, but needs execution infrastructure that does not exist yet.

## 3. Build the midcap book deliberately

The scoreboard's most under-used finding: **bigcap random entries returned
+0.226R over this window and midcap random returned -0.010R.** Bigcap numbers
are inflated by drift; midcap numbers are not. So a midcap edge of +0.22R is
worth more than a bigcap edge of +0.30R, and we are currently concentrated in
bigcap because the rare tier only works there.

Candidates already visible, both measured against a ~0R midcap baseline:

| strategy | midcap avgR | n |
|---|---|---|
| near-52w-high | +0.486 | 178 |
| volume-surge | +0.218 | 647 |
| ANY kind + confluence>=2 | +0.208 | 2111 |

- **Worth:** potentially a second independent income stream, uncorrelated with
  the rare tier because it fires on different pairs.
- **Falsified by:** the out-of-universe test. These midcaps ARE the
  out-of-universe set for the bigcap work, so a further held-out set is needed
  before trusting them — that is the standard that killed pairs trading.
- **Cost:** medium. Needs a genuinely untouched pair set.

## 4. Finish the two unfinished exit experiments

`partialExitTest.js` and `fvgCascadeTest.js` are committed but never produced a
recorded result, and the 4H test's conclusion lives only in a commit message.
The exit rule is where the single largest gain in this project came from
(0.453R -> 0.949R by removing the fixed target), so the remaining exit questions
are the highest-prior-probability place to look.

- **Worth:** unknown, but the prior is good — this is the same family as the
  change that doubled the edge.
- **Cost:** now small. `data/export/` makes these run in seconds.

## 5. Let the regime layer accumulate

The mechanism shipped; 24 of 81 cells cleared the evidence bar and the rare
tier's cells did not. Over this window bear was a **single 180-day episode**, so
regime conclusions are structurally unavailable, not merely unproven.

- **Worth:** unknown until more episodes exist. Do not force it.
- **What to do:** nothing except re-run `npm run scoreboard:regime` periodically.
  Cells qualify on their own without a code change.
- **Anti-goal:** relaxing the month-spread guards to "unlock" the +2.11R
  sideways cell. That number is one summer.

## 6. Measure your own follow-through

FOLLOW/SKIP decisions are recorded in `data/alert-log.json` and have never been
analysed. The gap between backtest expectancy and realised results is where
systems actually die — slippage, hesitation, early exits.

- **Worth:** diagnostic rather than additive, but it is the only way to learn
  whether the 0.911R is reachable in practice. The user's own stated history is
  losing on money management rather than direction, which is exactly what this
  measures.
- **Cost:** small. Needs enough decisions logged first.

---

## What NOT to do

Written down because each of these already cost real time here:

- **Adding more signal kinds.** All 15 were tested; the next best is under half
  the rare tier and most do not beat random.
- **Trading the news.** Two pre-registered hypothesis suites, both null.
- **Treating BTC BOS as an entry.** Measured: |t| < 1.7 on both 1D and 4H, and
  4H bearish breaks were followed by a small *positive* drift.
- **Re-enabling stocks without re-running the control.** 0.191R signal versus
  0.203R random.
- **Comparing anything to zero.** Every wrong conclusion in this project came
  from a large t-stat against zero instead of against the right baseline.
