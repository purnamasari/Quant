// Crypto scan — runs hourly during waking hours (see the separate Routine:
// cron `0 22-23,0-14 * * *` UTC = ~05:00-22:00 WIB; sub-hourly cron isn't
// supported by the platform), unlike the once-daily stock job.js. Crypto
// trades 24/7 but our signal still only truly finalizes at the fixed UTC
// daily candle cutoff (00:00 UTC = 07:00 WIB) — scanning hourly doesn't
// create a new timeframe/threshold, it just catches the SAME daily signal
// sooner:
//   - PROVISIONAL: seen while today's candle is still forming (confirm=0).
//     Can still change or disappear before the day closes — not backtested
//     behavior, purely a heads-up.
//   - CONFIRMED: seen after today's candle has closed. This is the signal
//     the backtest actually validated.
// Dedup (src/cryptoDedup.js) sends at most one PROVISIONAL and one
// CONFIRMED ping per symbol+kind+day, so hourly polling doesn't spam
// the same detection repeatedly.
//
// Rare high-conviction tier: cup-forming firing alongside >=2 total
// validated kinds (confluence) on the SAME day gets a distinct alert —
// extended 7-day hold framing instead of the default 2-day one — because
// that's the only combination that clears a 0.5R expectancy bar in
// backtesting (see data/crypto-signal-validation.md). Scoped to the
// original 12-pair universe only.

const config = require('./config');
const { sendMessage } = require('./telegram');
const cryptoUniverse = require('./crypto/universe');
const { getDailyCandles, getFundingRate } = require('./crypto/okx');
const { detectCryptoSignals } = require('./crypto/signals');
const { riskPlanFor } = require('./risk');
const { formatCryptoAlert } = require('./format');
const { getCryptoNews } = require('./news');
const { convictionFor } = require('./conviction');
const { nowStampWithWib } = require('./time');
const { ChartRenderer } = require('./chart');
const { shouldSend } = require('./cryptoDedup');
const { deliverAlerts } = require('./deliverAlert');
const { positionPlan } = require('./positionSizing');
const { checkProtections } = require('./protections');

// "Rare high-conviction" tier: cup-forming + same-day confluence with >=1
// other validated kind, R-multiple-backtested at 0.497 avgR / 67.8% WR
// (n=118, 7-day hold) — see data/crypto-signal-validation.md. Deliberately
// scoped to ONLY the original 12-pair validation universe: re-testing on 18
// additional mid-cap pairs showed the edge weaken sharply there (0.095R,
// 43% WR), so this tier must not silently extend if CRYPTO_WATCHLIST is
// customized to a wider set.
const CONFLUENCE_PARTNER_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming', 'bos-bullish'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scanCrypto() {
  const universe = cryptoUniverse.getUniverse();
  const alerts = [];
  const failures = [];
  for (const symbol of universe) {
    try {
      const candles = await getDailyCandles(symbol, 300);
      if (candles.length < 60) continue;
      const provisional = candles[candles.length - 1].confirmed === false;

      const funding = await getFundingRate(symbol).catch(() => null);
      const { signals } = detectCryptoSignals(candles, funding);
      const matched = signals.filter((s) => (s.kind === 'funding-extreme' ? false : config.alertCryptoKinds.includes(s.kind)));
      if (!matched.length) continue;

      // Circuit breakers run before anything is composed, so a blocked pair
      // costs no chart render or news fetch. The reason is logged rather than
      // silently swallowed — a suppressed signal you never hear about is
      // indistinguishable from no signal, which is the failure mode this
      // project keeps running into.
      const guard = checkProtections(symbol);
      if (guard.blocked) {
        console.log(`[cryptoJob] ${symbol} suppressed — ${guard.reason}`);
        continue;
      }

      const confluenceCount = signals.filter((s) => CONFLUENCE_PARTNER_KINDS.includes(s.kind)).length;
      const rareTierEligible = cryptoUniverse.RARE_TIER_UNIVERSE.includes(symbol) && confluenceCount >= 2;

      const plan = riskPlanFor(candles);
      const coinName = symbol.split('-')[0];
      const news = await getCryptoNews(`${coinName} crypto`, 2);
      for (const signal of matched) {
        const rareTier = signal.kind === 'cup-forming' && rareTierEligible;
        const status = provisional ? 'provisional' : 'confirmed';
        const dedupKind = rareTier ? 'cup-forming-confluence' : signal.kind;
        if (!shouldSend(symbol, dedupKind, status)) continue;

        const conviction = convictionFor('crypto', rareTier ? 'cup-forming-confluence' : signal.kind);
        const position = positionPlan({
          stopDistancePercent: plan.stopDistancePercent,
          entry: plan.entry,
          fundingRate: funding?.fundingRate,
        });
        alerts.push({
          market: 'crypto',
          symbol,
          kind: signal.kind,
          direction: signal.direction,
          conviction: conviction.tier,
          candles,
          plan,
          signal,
          chartTitle: `${symbol} — ${signal.label}${rareTier ? ' + confluence (RARE)' : ''} [${signal.direction === 'short' ? 'SHORT' : 'LONG'}]${provisional ? ' (provisional)' : ''}`,
          text: formatCryptoAlert({ symbol, signal, plan, news, conviction, provisional, rareTier, position }),
        });
      }
    } catch (err) {
      console.error(`[cryptoJob] ${symbol} failed:`, err.message);
      failures.push({ symbol, message: err.message });
    }
    await sleep(200);
  }
  return { alerts, failures, scanned: universe.length };
}

async function main() {
  const startedAt = new Date();
  const { alerts, failures, scanned } = await scanCrypto();
  const ok = scanned - failures.length;
  console.log(
    `[cryptoJob] ${alerts.length} new alert(s) (after dedup) at ${nowStampWithWib(startedAt)}` +
    ` — ${ok}/${scanned} pairs scanned OK${failures.length ? `, ${failures.length} FAILED` : ''}`,
  );

  // A total data outage previously printed the same "0 new alert(s)" line as a
  // healthy quiet scan, so under cron it would have been invisible — silence
  // reads identically to "market was quiet". Surface it instead: notify once
  // per day (reusing the alert dedup so an hours-long outage doesn't spam) and
  // exit non-zero so a cron wrapper or healthcheck can see it.
  if (failures.length === scanned && scanned > 0) {
    console.error(`[cryptoJob] ALL ${scanned} pairs failed — treating as a data outage, not a quiet scan`);
    if (shouldSend('_system', 'data-outage', 'error')) {
      const reason = failures[0]?.message || 'unknown error';
      await sendMessage(
        `⚠️ <b>Crypto scan gagal total</b> — ${scanned}/${scanned} pair tidak bisa diambil datanya, ` +
        `padahal tiap request sudah di-retry 3x.\n\n` +
        `Error: <code>${reason}</code>\n\n` +
        `Penyebab tersering bukan OKX-nya, tapi kegagalan DNS/jaringan di sisi server ` +
        `(503 dengan body "DNS resolution failure" pernah terjadi 2x dalam sehari dan pulih sendiri ` +
        `dalam beberapa menit). Karena retry pun gagal, ini lebih lama dari biasanya — ` +
        `cek konektivitas server kalau berlanjut.`,
      ).catch((err) => console.error('[cryptoJob] outage notice failed:', err.message));
    }
    process.exitCode = 1;
    return;
  }

  if (!alerts.length) return; // most hourly checks find nothing new — expected

  const renderer = new ChartRenderer();
  try {
    await deliverAlerts(alerts, renderer);
  } finally {
    await renderer.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[cryptoJob] fatal:', err);
    process.exit(1);
  });
}

module.exports = { scanCrypto, main };
