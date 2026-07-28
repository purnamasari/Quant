const fs = require('node:fs');
const path = require('node:path');

const TABLE = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'signal-conviction.json'), 'utf8'),
);

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

function convictionFor(market, kind) {
  const entry = TABLE[market]?.[kind] || TABLE.default;
  return {
    tier: entry.tier,
    label: TIER_LABEL[entry.tier] || 'LOW',
    emoji: TIER_EMOJI[entry.tier] || '▫️',
    reason: entry.reason,
  };
}

module.exports = { convictionFor };
