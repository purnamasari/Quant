// Telegram Mini App backend. Serves the dashboard page plus a small JSON API
// over the data the scan already writes — no database, no framework, no
// dependencies beyond Node's own http module.
//
// Scope note: `ashcel/market-pulse` was the requested home for this, but it is
// a private repo under a different owner and this session cannot reach it
// (neither git clone nor add_repo). So the Mini App lives here, reading
// notifier-bot's own data directly. Moving it later is a copy of this folder
// plus a base-URL change; nothing here reaches into the rest of src/ except to
// read the same JSON files the jobs write.
//
// SECURITY: Telegram Mini Apps authenticate with an initData string signed by
// the bot token. Validating it is required before this is exposed publicly —
// see verifyInitData below, which is implemented and enforced when
// DASHBOARD_REQUIRE_AUTH is on. It defaults ON precisely because the failure
// mode of forgetting is silent: the dashboard would serve your positions and
// P&L to anyone who found the URL.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../config');
const { fullState, tokenDetail } = require('./state');

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const PORT = Number(process.env.DASHBOARD_PORT || 8787);
const REQUIRE_AUTH = process.env.DASHBOARD_REQUIRE_AUTH !== 'false';
// Telegram signs initData with a key derived from the bot token. Rejecting
// anything older than this limits replay of a leaked initData string.
const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch {
    return fallback;
  }
}

// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// The hash is HMAC-SHA256 over the sorted "key=value" pairs, keyed by
// HMAC-SHA256("WebAppData", botToken).
function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return { ok: false, reason: 'missing initData or bot token' };
  let params;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, reason: 'unparseable initData' };
  }
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'no hash in initData' };
  params.delete('hash');

  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

  // Constant-time compare — a plain === leaks timing information about how much
  // of the hash matched.
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'hash mismatch' };
  }

  const authDate = Number(params.get('auth_date') || 0);
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (!authDate || age > INIT_DATA_MAX_AGE_SECONDS) {
    return { ok: false, reason: `initData too old (${age}s)` };
  }

  // Only the chat this bot is configured for may read the dashboard. Without
  // this any Telegram user who opened the Mini App would see the account's
  // signals — a valid signature proves "a real Telegram user", not "the owner".
  let user = null;
  try { user = JSON.parse(params.get('user') || 'null'); } catch { /* leave null */ }
  if (config.telegramChatId && user && String(user.id) !== String(config.telegramChatId)) {
    return { ok: false, reason: 'user is not the configured chat owner' };
  }

  return { ok: true, user };
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function handleApi(req, res, url) {
  if (REQUIRE_AUTH) {
    const initData = req.headers['x-telegram-init-data'];
    const check = verifyInitData(initData, config.telegramBotToken);
    if (!check.ok) {
      // The reason is logged, not returned — telling a caller *why* their forged
      // initData failed helps them forge a better one.
      console.warn(`[dashboard] auth rejected: ${check.reason}`);
      return json(res, 401, { error: 'unauthorized' });
    }
  }
  try {
    if (url.pathname === '/api/token') {
      const symbol = url.searchParams.get('symbol') || '';
      return json(res, 200, await tokenDetail(symbol));
    }
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 14));
    return json(res, 200, await fullState({ days }));
  } catch (err) {
    // A section failing must return a readable error, not a hung request —
    // the page has no other way to tell "still loading" from "broken".
    console.error('[dashboard] state failed:', err.message);
    return json(res, 500, { error: 'state unavailable' });
  }
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function serveStatic(res, name) {
  // Resolve then confirm containment, so a crafted path cannot escape the
  // public directory.
  const file = path.resolve(PUBLIC_DIR, name);
  if (!file.startsWith(PUBLIC_DIR + path.sep) && file !== path.join(PUBLIC_DIR, 'index.html')) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (url.pathname === '/healthz') return json(res, 200, { ok: true });
  if (url.pathname === '/' || url.pathname === '/index.html') return serveStatic(res, 'index.html');
  return serveStatic(res, url.pathname.replace(/^\/+/, ''));
});

function start() {
  server.listen(PORT, () => {
    console.log(`[dashboard] listening on :${PORT} (auth ${REQUIRE_AUTH ? 'ENFORCED' : 'DISABLED — dev only'})`);
    if (!REQUIRE_AUTH) {
      console.warn('[dashboard] DASHBOARD_REQUIRE_AUTH=false — do not expose this port publicly');
    }
  });
}

if (require.main === module) start();

module.exports = { start, verifyInitData, server };
