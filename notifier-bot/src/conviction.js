const fs = require('node:fs');
const path = require('node:path');

const TABLE = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'signal-conviction.json'), 'utf8'),
);

// Regime adjustments are generated, not hand-written — see
// src/analysis/regimeScoreboard.js. Every cell in that file carries the
// evidence that produced it and, where the evidence was refused, the reason
// it was refused. A missing file is not an error: it means no regime
// adjustment applies, which is the same state as a file where nothing cleared
// the bar.
let REGIME_TABLE = { strategies: {} };
try {
  REGIME_TABLE = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'regime-adjustments.json'), 'utf8'),
  );
} catch {
  // no-op — see above
}

const TIER_LABEL = {
  'very-high': 'VERY HIGH',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

const TIER_EMOJI = {
  'very-high': '⭐⭐⭐',
  high: '⭐⭐',
  medium: '⭐',
  low: '▫️',
};

// Ordered weakest to strongest. A regime adjustment moves one step along this.
const TIER_ORDER = ['low', 'medium', 'high', 'very-high'];

// Promotion stops at 'high'. very-high is reserved for the one setup that
// earned it on its own measurement (crypto cup-forming + confluence: 0.911R
// against a 0.005R random control), and a regime nudge is far weaker evidence
// than that. Letting regime manufacture a very-high would put the loudest
// badge in the bot behind its least-tested input.
const MAX_PROMOTED_TIER = 'high';

function step(tier, delta) {
  const i = TIER_ORDER.indexOf(tier);
  if (i === -1) return tier;
  if (delta > 0) {
    // Cap promotions, but never demote something that already sits above the cap.
    return TIER_ORDER[Math.max(i, Math.min(i + delta, TIER_ORDER.indexOf(MAX_PROMOTED_TIER)))];
  }
  return TIER_ORDER[Math.max(0, i + delta)];
}

function regimeAdjustment(strategyKey, regime) {
  if (!regime || !strategyKey) return null;
  const cell = REGIME_TABLE.strategies?.[strategyKey]?.[regime];
  if (!cell || !cell.adjust) return null;
  return cell;
}

// `regime` is 'bull' | 'sideways' | 'bear' | null, from src/regime.js.
// `strategyKey` defaults to the kind but can be overridden — the rare tier is
// measured under its own name, not under plain 'cup-forming', and must not
// borrow another row's evidence.
function convictionFor(market, kind, { regime = null, strategyKey = null } = {}) {
  const entry = TABLE[market]?.[kind] || TABLE.default;
  const baseTier = entry.tier;
  const cell = regimeAdjustment(strategyKey || kind, regime);

  const tier = cell ? step(baseTier, cell.adjust) : baseTier;
  return {
    tier,
    baseTier,
    label: TIER_LABEL[tier] || 'LOW',
    emoji: TIER_EMOJI[tier] || '▫️',
    reason: entry.reason,
    regime,
    regimeAdjusted: tier !== baseTier,
    regimeEvidence: cell
      ? {
        adjust: cell.adjust,
        n: cell.n,
        avgR: cell.avgR,
        winRate: cell.winRate,
        edgeVsRandom: cell.edgeVsRandom,
      }
      : null,
  };
}

// Only these tiers earn a push. Everything else is still detected, still
// scored, and still written to the dashboard store — it just does not
// interrupt anyone.
const NOTIFY_TIERS = new Set(['very-high', 'high']);
const shouldNotify = (tier) => NOTIFY_TIERS.has(tier);

module.exports = {
  convictionFor, shouldNotify, NOTIFY_TIERS, TIER_ORDER, TIER_LABEL, TIER_EMOJI,
};
