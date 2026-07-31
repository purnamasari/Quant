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
// (As of the 2026-07-31 regime-gated validation this tier is reachable
// again, but only in the regimes where cup-forming itself is allowed —
// bear and sideways, per config.regimeGates. In a bull regime cup-forming
// is filtered out before confluence is even considered, so no rare-tier
// alert can fire there. NOTE: the tier is NOT re-validated on Binance —
// shipped-exit-rule re-measurement is 0.841R/14d on the full window but
// the time-stability split yields n=0 in the most recent 365 days, and
// cup-forming's gate is EXPLORATORY (fails its own independence guards).
// See data/binance-revalidation-2026-07-31.md §4/§7.)

const config = require('./config');
const { sendMessage } = require('./telegram');
const cryptoUniverse = require('./crypto/universe');
const { getDailyCandles, getFundingRate } = require('./crypto/binance');
const { detectCryptoSignals } = require('./crypto/signals');
const { riskPlanFor } = require('./risk');
const { formatCryptoAlert, formatStructureAlert } = require('./format');
const { getCryptoNews } = require('./news');
const { convictionFor, shouldNotify } = require('./conviction');
const { classifyLatest } = require('./regime');
const { marketStructure } = require('./marketStructure');
const { statsFor } = require('./signalStats');
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
// customized to a wider set. Note this list is the confluence COUNT input and
// is deliberately not regime-gated: the gate in scanCrypto decides what may be
// alerted, while confluence here just measures how much agreed on the day.
const CONFLUENCE_PARTNER_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge', 'cup-forming', 'bos-bullish'];

// Same-day agreement among the 3 unconditional kinds is itself an edge
// (quant sweep 2026-07-31: >=2 kinds same day +2.79% vs singles +0.58%,
// stable both halves — QUANT_TASKS.md §3). Boosts conviction one tier.
const UNCONDITIONAL_KINDS = ['ma-alignment', 'near-52w-high', 'volume-surge'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Relative volume against the trailing 20 days, used as a "why" factor. Kept
// descriptive rather than promoted to a filter: volume-surge is already a
// validated kind in its own right, and turning the same information into a
// second gate would double-count it.
function relativeVolume(candles) {
  if (candles.length < 21) return null;
  const recent = candles[candles.length - 1].volume;
  const prior = candles.slice(-21, -1);
  const avg = prior.reduce((a, c) => a + c.volume, 0) / prior.length;
  return avg > 0 ? Math.round((recent / avg) * 10) / 10 : null;
}

// The strongest contributing factors, strongest first, for the "why" line.
// Only facts that are measured somewhere — no adjectives invented at send time.
function whyFactors({
  stats, conviction, regime, confluenceCount, relVol, news, rareTier, uncondConfluence = 0,
}) {
  const out = [];
  // Recomputed from the same tier-scoped numbers the stats block prints, NOT
  // from stats.beatsRandom, which is measured against the all-pairs baseline.
  // Using both put two different edges for one signal in one message (+0.282R
  // in the header, +0.237R three lines below it).
  if (stats && stats.randomBaseline !== null && stats.randomBaseline !== undefined) {
    const edge = Math.round((stats.avgR - stats.randomBaseline) * 1000) / 1000;
    if (edge > 0) out.push(`edge +${edge}R di atas entry acak (rank #${stats.rank}/${stats.of}, n=${stats.n})`);
  }
  if (rareTier || confluenceCount >= 2) {
    out.push(`${confluenceCount} sinyal tervalidasi barengan hari ini`);
  }
  if (uncondConfluence >= 2) out.push(`⚡ ${uncondConfluence} sinyal utama barengan hari ini (confluence historis +2.79% cost-adj)`);
  if (conviction?.regimeAdjusted) {
    out.push(`regime ${regime} historisnya ${conviction.regimeEvidence.adjust > 0 ? 'mendukung' : 'melawan'} strategi ini (n=${conviction.regimeEvidence.n})`);
  }
  if (relVol && relVol >= 1.5) out.push(`volume ${relVol}x rata-rata 20 hari`);
  if (news?.length) out.push(`${news.length} berita terbaru terlampir`);
  return out;
}

async function scanCrypto() {
  const universe = cryptoUniverse.getUniverse();
  const alerts = [];
  const failures = [];

  // One regime for the whole scan, taken from BTC — see src/regime.js for why
  // it is not computed per symbol. Failing to fetch BTC must not abort the
  // scan; a null regime simply means no regime adjustment is applied.
  let regime = null;
  try {
    const btc = await getDailyCandles('BTCUSDT', 300);
    regime = classifyLatest(btc);
    console.log(`[cryptoJob] market regime: ${regime ?? 'unknown'}`);
  } catch (err) {
    console.warn(`[cryptoJob] regime unavailable (${err.message}) — conviction will not be regime-adjusted`);
  }

  for (const symbol of universe) {
    try {
      const candles = await getDailyCandles(symbol, 300);
      if (candles.length < 60) continue;
      const provisional = candles[candles.length - 1].confirmed === false;

      const funding = await getFundingRate(symbol).catch(() => null);
      const { signals } = detectCryptoSignals(candles, funding);
      const matched = signals.filter((s) => {
        if (s.kind === 'funding-extreme') return false;
        if (!config.alertCryptoKinds.includes(s.kind)) return false;
        const allowed = config.regimeGates && config.regimeGates[s.kind];
        return allowed ? allowed.includes(regime) : true;
      });
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
      const uncondCount = signals.filter((s) => UNCONDITIONAL_KINDS.includes(s.kind)).length;
      const confluenceBoost = uncondCount >= 2 ? 1 : 0;

      const plan = riskPlanFor(candles);
      const coinName = symbol.replace(/-USDT-SWAP$/, '').replace(/-USDT$/, '').replace(/USDT$/, '');
      const news = await getCryptoNews(`${coinName} crypto`, 2);
      for (const signal of matched) {
        const rareTier = signal.kind === 'cup-forming' && rareTierEligible;
        const status = provisional ? 'provisional' : 'confirmed';
        const dedupKind = rareTier ? 'cup-forming-confluence' : signal.kind;
        if (!shouldSend(symbol, dedupKind, status)) continue;

        // strategyKey selects which scoreboard row's regime evidence applies.
        // The rare tier is measured under its own name and must not inherit
        // plain cup-forming's row.
        const strategyKey = rareTier ? 'RARE (as shipped)' : signal.kind;
        const conviction = convictionFor('crypto', rareTier ? 'cup-forming-confluence' : signal.kind, {
          regime,
          strategyKey,
          // The rare tier's own measurement already prices confluence in —
          // boosting it again would double-count the same evidence.
          boost: rareTier ? 0 : confluenceBoost,
        });
        const capTier = cryptoUniverse.DEFAULT_VALIDATION_UNIVERSE.includes(symbol) ? 'bigcap' : 'midcap';
        const stats = statsFor({ kind: signal.kind, rareTier, capTier });
        const relVol = relativeVolume(candles);
        const position = positionPlan({
          stopDistancePercent: plan.stopDistancePercent,
          entry: plan.entry,
          fundingRate: funding?.fundingRate,
        });
        const why = whyFactors({
          stats, conviction, regime, confluenceCount, relVol, news, rareTier, uncondConfluence: uncondCount,
        });

        alerts.push({
          market: 'crypto',
          symbol,
          kind: signal.kind,
          direction: signal.direction,
          conviction: conviction.tier,
          baseConviction: conviction.baseTier,
          regime,
          regimeAdjusted: conviction.regimeAdjusted,
          notify: shouldNotify(conviction.tier),
          rank: stats?.rank ?? null,
          stats,
          provisional,
          candles,
          plan,
          signal,
          chartTitle: `${symbol} — ${signal.label}${rareTier ? ' + confluence (RARE)' : ''} [${signal.direction === 'short' ? 'SHORT' : 'LONG'}]${provisional ? ' (provisional)' : ''}`,
          text: formatCryptoAlert({
            symbol, signal, plan, news, conviction, provisional, rareTier, position, stats, regime, why,
          }),
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

// BTC structure breaks are announced before the per-symbol scan results,
// because they change how you read everything below them. Deduped through the
// same store as signal alerts so a break is announced once, not once per hourly
// run for as long as it remains the most recent bar.
async function announceStructure() {
  try {
    const structure = await marketStructure();
    let sent = 0;
    for (const alert of structure.alerts) {
      const dedupKey = `${alert.timeframe}-${alert.direction}`;
      if (!shouldSend('BTC-STRUCTURE', dedupKey, 'confirmed')) continue;
      await sendMessage(formatStructureAlert({
        alert, daily: structure.daily, fourHour: structure.fourHour,
      }));
      sent += 1;
    }
    console.log(
      `[cryptoJob] structure — 1D ${structure.daily.bias ?? 'unknown'}, ` +
      `4H ${structure.fourHour.bias ?? 'unknown'}, ${sent} break alert(s)`,
    );
    return structure;
  } catch (err) {
    // Structure is context, not the job's purpose — never let it abort the scan.
    console.warn(`[cryptoJob] structure check failed: ${err.message}`);
    return null;
  }
}

async function main() {
  const startedAt = new Date();
  await announceStructure();
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
        `Penyebab tersering bukan Binance-nya, tapi kegagalan DNS/jaringan di sisi server ` +
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
    const { notified, silent } = await deliverAlerts(alerts, renderer);
    // Reported separately because they mean different things: `silent` is the
    // policy working, not signals being lost. They are in data/signal-feed.json.
    console.log(`[cryptoJob] pushed ${notified}, kept silent ${silent} (dashboard only)`);
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
