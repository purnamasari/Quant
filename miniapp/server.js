// Tradeway Mini — a standalone Telegram Mini App server.
//
// It owns no data. Three services already run on this box and each one already
// knows how to answer the question it owns:
//
//   quant     :8787  regime, signal feed, token candles + forecast
//   tradeway  :8100  open Bybit positions
//   market    :8002  Market Pulse (FastAPI) universe / sentiment / macro
//
// This process is the single origin the Mini App page talks to: it serves the
// page, checks that the caller is the owner, and forwards. Keeping the
// aggregation here (rather than in the page) means the page never holds the
// Market Pulse internal key, and the browser only ever sees one host.
//
// SECURITY: every /api/* route is gated on a Telegram initData signature —
// see verifyInitData, ported from notifier-bot's dashboard server. The page
// itself is served unauthenticated (it renders a "open me from Telegram" gate
// when initData is absent), because the page alone leaks nothing.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PUBLIC_DIR = path.join(__dirname, 'public');
// Telegram signs initData with a key derived from the bot token. Rejecting
// anything older than this limits replay of a leaked initData string.
const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

const QUANT_BASE = 'http://localhost:8787';
const TRADEWAY_BASE = 'http://localhost:8100';
const MARKET_BASE = 'http://localhost:8002/api/v1';

// KEY=VALUE, no dependency. Values are read once at boot and never logged.
function loadEnv(file) {
  const env = {};
  let raw = '';
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return env;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = { ...loadEnv(path.join(__dirname, '.env')), ...process.env };
const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN || '';
const ALLOWED_USER_ID = String(env.MINIAPP_ALLOWED_USER_ID || '');
const MP_KEY = env.MP_INTERNAL_KEY || '';
const MP_USER = env.MP_OWNER_USER_ID || '';
const PORT = Number(env.PORT || 8790);

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

  // A valid signature proves "a real Telegram user", not "the owner" — so the
  // signing user is checked against the allowlist as well.
  let user = null;
  try { user = JSON.parse(params.get('user') || 'null'); } catch { /* leave null */ }
  if (!ALLOWED_USER_ID || String(user?.id) !== ALLOWED_USER_ID) {
    return { ok: false, reason: 'user is not the allowed owner' };
  }

  return { ok: true, user };
}

const MP_HEADERS = { 'X-Internal-Key': MP_KEY, 'X-Internal-User-Id': MP_USER };

// Market Pulse keys its tokens, events and sentiment by the bare asset
// ("BTC"), while the quant feed speaks in trading pairs ("BTCUSDT"). The page
// only ever knows the pair, so the quote is stripped here rather than in the
// browser — one place, and the backend's own /^[A-Z0-9]{1,12}$/ guard is
// mirrored so a bad symbol is a 400 here instead of a 400 upstream.
const MP_QUOTES = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'TUSD', 'USD'];
function baseSymbol(raw) {
  let s = String(raw == null ? '' : raw).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const q of MP_QUOTES) {
    if (s.length > q.length && s.endsWith(q)) { s = s.slice(0, -q.length); break; }
  }
  return /^[A-Z0-9]{1,12}$/.test(s) ? s : '';
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

// One upstream call, one JSON answer. A dead upstream is a 503 with a name in
// it — the page shows a per-tab offline state rather than a blank screen.
async function proxyJson(res, target, headers, label) {
  let upstream;
  try {
    upstream = await fetch(target, { headers });
  } catch (err) {
    console.warn(`[miniapp] ${label} unreachable: ${err.message}`);
    return json(res, 503, { error: `${label} unavailable` });
  }
  const text = await upstream.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    console.warn(`[miniapp] ${label} returned non-JSON (${upstream.status})`);
    return json(res, 502, { error: `${label} returned non-JSON` });
  }
  return json(res, upstream.status, body);
}

async function handleApi(req, res, url) {
  const initData = req.headers['x-telegram-init-data'];
  const check = verifyInitData(initData, BOT_TOKEN);
  if (!check.ok) {
    // The reason is logged, not returned — telling a caller *why* their forged
    // initData failed helps them forge a better one.
    console.warn(`[miniapp] auth rejected: ${check.reason}`);
    return json(res, 401, { error: 'unauthorized' });
  }

  const p = url.pathname;

  if (p === '/api/quant/state' || p === '/api/quant/token') {
    // The quant dashboard does its own initData check, so the client's string
    // is forwarded verbatim rather than re-signed.
    const target = `${QUANT_BASE}/api/${p === '/api/quant/state' ? 'state' : 'token'}${url.search}`;
    return proxyJson(res, target, { 'x-telegram-init-data': initData }, 'quant-api');
  }

  if (p === '/api/tradeway/positions') {
    return proxyJson(res, `${TRADEWAY_BASE}/positions`, {}, 'tradeway-api');
  }

  // The Mini App speaks in Quant pairs (BTCUSDT), whereas Market Pulse's
  // token and event stores use the bare asset (BTC). These two small routes
  // are deliberately explicit: their browser-friendly names differ from the
  // Python API's /market/tokens/{symbol} and /events/token-events paths.
  const tokenMatch = p.match(/^\/api\/market\/token\/([^/]+)$/);
  if (tokenMatch) {
    const symbol = baseSymbol(tokenMatch[1]);
    if (!symbol) return json(res, 400, { error: 'bad token symbol' });
    return proxyJson(res, `${MARKET_BASE}/market/tokens/${encodeURIComponent(symbol)}`, MP_HEADERS, 'market-token');
  }

  if (p === '/api/market/token-events') {
    const query = new URLSearchParams(url.search);
    const symbol = baseSymbol(query.get('symbol'));
    if (!symbol) return json(res, 400, { error: 'bad token symbol' });
    query.set('symbol', symbol);
    query.delete('symbols');
    return proxyJson(res, `${MARKET_BASE}/events/token-events?${query.toString()}`, MP_HEADERS, 'market-events');
  }

  if (p.startsWith('/api/market/')) {
    const rest = p.slice('/api/market/'.length);
    if (!rest || rest.includes('..')) return json(res, 400, { error: 'bad market path' });
    return proxyJson(res, `${MARKET_BASE}/${rest}${url.search}`, {
      'X-Internal-Key': MP_KEY,
      'X-Internal-User-Id': MP_USER,
    }, 'market-api');
  }

  return json(res, 404, { error: 'not found' });
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
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
  res.on('finish', () => console.log(`${req.method} ${url.pathname} ${res.statusCode}`));
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (url.pathname === '/healthz') return json(res, 200, { ok: true });
  if (url.pathname === '/' || url.pathname === '/index.html') return serveStatic(res, 'index.html');
  return serveStatic(res, url.pathname.replace(/^\/+/, ''));
});

function start() {
  if (!BOT_TOKEN || !ALLOWED_USER_ID) {
    // Without both, every /api/* call would 401 anyway — say so at boot rather
    // than leaving the page silently empty.
    console.warn('[miniapp] TELEGRAM_BOT_TOKEN or MINIAPP_ALLOWED_USER_ID missing — API will reject all callers');
  }
  server.listen(PORT, () => console.log(`[miniapp] listening on :${PORT}`));
}

if (require.main === module) start();

module.exports = { start, verifyInitData, server };
