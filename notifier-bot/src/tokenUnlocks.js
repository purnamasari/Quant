// Token unlock reminder — NOT a live feed. No reliable free/scrapable API
// was found for this tonight: token.unlocks.app is a JS-rendered Next.js
// app (not a plain JSON endpoint reachable via curl), and DefiLlama's
// `/emissions` API now returns HTTP 402 (paid plan required). Rather than
// fake a live source, this reads a small user-maintained JSON file —
// update data/token-unlocks.json yourself when you know of an upcoming
// unlock for something you're trading. Format:
// [{ "symbol": "HYPE", "date": "2026-08-15", "note": "12-month cliff, ~5% of supply" }]

const fs = require('node:fs');
const path = require('node:path');

function loadUnlocks() {
  const filePath = path.join(__dirname, '..', 'data', 'token-unlocks.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.error('[tokenUnlocks] failed to parse data/token-unlocks.json:', err.message);
    return [];
  }
}

function tomorrowYmd() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getTomorrowUnlocks() {
  const tomorrow = tomorrowYmd();
  return loadUnlocks().filter((u) => u.date === tomorrow);
}

module.exports = { loadUnlocks, getTomorrowUnlocks };
