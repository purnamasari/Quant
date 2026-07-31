// Telegram HTML parse_mode chokes on stray <, >, & in dynamic text (news
// headlines, signal detail strings) — escape before interpolating into
// hand-built tags like <a href="...">.
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const { withWib, withEtAndWib } = require('./time');
const { expectancyPercent } = require('./signalStats');
const { REGIME_LABEL, REGIME_EMOJI } = require('./regime');

function toneEmoji(tone) {
  if (tone === 'hot') return '🔥';
  if (tone === 'watch') return '👀';
  return '📈';
}

function directionLabel(direction) {
  return direction === 'short' ? '🔴 SHORT' : '🟢 LONG';
}

// Capped at two items: the whole message is now a photo caption, and Telegram
// truncates captions at 1024 chars. News is the least decision-relevant block
// in the message, so it is what gives up room first.
function newsLines(news) {
  if (!news?.length) return [];
  return [
    '',
    '📰 News:',
    ...news.slice(0, 2).map((n) => (n.link ? `• <a href="${escapeHtml(n.link)}">${escapeHtml(n.title)}</a>` : `• ${escapeHtml(n.title)}`)),
  ];
}

function convictionLine(conviction) {
  if (!conviction) return null;
  return `${conviction.emoji} Conviction: <b>${conviction.label}</b> — <i>${escapeHtml(conviction.reason)}</i>`;
}

// The measured-performance block. This replaces the conviction *label* as the
// headline, because a label is a summary of these numbers and the numbers are
// what a decision actually needs: how much this setup has returned per trade
// and on how many samples.
//
// One line only. The random-baseline comparison and the exit-rule reminder
// both used to live here; they are context you re-read once and then know, and
// the caption budget is better spent on the levels. The edge-vs-random figure
// still reaches the message when it matters — whyFactors promotes it into the
// "Kenapa" line.
function statsLines(stats, plan) {
  if (!stats) return [];
  const pct = expectancyPercent(stats.avgR, plan?.stopDistancePercent);
  const rr = stats.rr === null ? '—' : stats.rr.toFixed(2);
  const scope = stats.capTier === 'all' ? '' : ` (${stats.capTier})`;
  return [
    `📊 <b>${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(3)}R/trade</b>` +
    `${pct !== null ? ` ≈ ${pct >= 0 ? '+' : ''}${pct}%` : ''} · ` +
    `WR ${stats.winRate}% · RR ${rr} · n=${stats.n}${scope}`,
  ];
}

function regimeLine(regime, conviction) {
  if (!regime) return null;
  const base = `${REGIME_EMOJI[regime] || ''} Regime: <b>${REGIME_LABEL[regime] || regime}</b> (BTC 200SMA)`;
  if (!conviction?.regimeAdjusted) return base;
  const dir = conviction.regimeEvidence.adjust > 0 ? 'naik' : 'turun';
  return `${base} → conviction ${dir} 1 tier`;
}

// "Why high conviction", assembled from the strongest contributing factors
// rather than written by hand per signal. Capped at three: the point is to
// answer "why should I look at this one" in a glance, and a list of six
// reasons is the information overload this block exists to avoid.
function whyLines(factors) {
  const top = (factors || []).filter(Boolean).slice(0, 3);
  if (!top.length) return [];
  return ['', `💡 <b>Kenapa:</b> ${top.map((f) => escapeHtml(f)).join(' · ')}`];
}

// Leverage, one line. The number people get wrong is the leverage, and it is
// derived from this setup's stop width rather than chosen by feel — that is
// the whole decision. Notional/margin/funding rows were four more lines that
// nobody acted on inside a 1024-char caption.
//
// Warnings survive as their own lines: they are rare, and each one is a reason
// not to take the trade as sized.
function positionLines(position) {
  if (!position) return [];
  const lines = [`⚙️ Max aman ${position.maxSafeLeverage}x → pakai <b>${position.suggestedLeverage}x</b>`];
  for (const w of position.warnings || []) lines.push(`⚠️ ${escapeHtml(w)}`);
  return lines;
}

// Ensemble odds from the same projection drawn on the chart, so the picture
// and the caption cannot tell different stories. Bars-to-TP is a mean over the
// paths that actually reached TP — null when none did, which is information,
// not a gap to hide.
function forecastLine(meta) {
  if (!meta) return null;
  const pct = (p) => (Number.isFinite(p) ? `${Math.round(p * 100)}%` : '—');
  const bars = Number.isFinite(meta.barsToTp) ? `~${Math.round(meta.barsToTp)} bar ke TP` : '— bar ke TP';
  return `🎯 TP ${pct(meta.tpHitProbability)} · SL ${pct(meta.slHitProbability)} · ${bars}`;
}

function formatStockAlert({ symbol, name, signal, plan, earningsWarning, news, conviction }) {
  const lines = [
    `${toneEmoji(signal.tone)} <b>${escapeHtml(symbol)}</b> — ${escapeHtml(signal.label)} [${directionLabel(signal.direction)}]`,
    name ? `<i>${escapeHtml(name)}</i>` : null,
    escapeHtml(signal.detail),
    convictionLine(conviction),
    '',
    `Entry ${plan.entry} | Stop ${plan.stop} | Target ${plan.target} | R:R ${plan.rewardRisk ?? '-'}`,
    `Stop distance: ${plan.stopDistancePercent}%`,
    ...newsLines(news),
  ];
  if (earningsWarning) lines.push('', `⚠️ ${earningsWarning}`);
  return lines.filter((l) => l !== null).join('\n');
}

// Ordered by what changes a decision. Measured expectancy first, then the
// levels, then sizing, then context. The conviction label moved to the header
// and its prose reason was dropped from the body: the reason was a sentence
// restating numbers that now appear directly above it.
//
// Hard budget: this string is now a photo caption, and Telegram cuts captions
// at 1024 chars. Anything added here has to displace something.
function formatCryptoAlert({
  symbol, signal, plan, news, conviction, provisional, rareTier, position, stats, regime, why,
  forecastMeta = null,
}) {
  const lines = [
    `${conviction?.emoji ?? toneEmoji(signal.tone)} <b>${escapeHtml(symbol)}</b> — ` +
    `${escapeHtml(signal.label)}${rareTier ? ' + confluence' : ''} ${directionLabel(signal.direction)}` +
    `${conviction ? ` · ${conviction.label}` : ''}`,
    provisional
      ? '🟡 PROVISIONAL — candle harian belum closing, sinyal masih bisa berubah.'
      : '🟢 CONFIRMED — candle harian sudah closing.',
    '',
    ...statsLines(stats, plan),
    regimeLine(regime, conviction),
    ...whyLines(why),
    '',
    `Entry <b>${plan.entry}</b> | Stop <b>${plan.stop}</b> (−${Number(plan.stopDistancePercent).toFixed(2)}%) | Ref <b>${plan.target}</b>`,
    ...positionLines(position),
    forecastLine(forecastMeta),
    ...newsLines(news),
    '',
    '<i>Harga via Binance — cek di venue kamu sebelum entry.</i>',
  ];
  return lines.filter((l) => l !== null).join('\n');
}

// BTC break-of-structure notice. Deliberately worded as context, never as an
// entry: the forward move after a BTC BOS measured indistinguishable from noise
// on both 1D and 4H (every |t| < 1.7, and 4H bearish breaks were followed by a
// small POSITIVE drift). Saying "structure broke, here is what that changes"
// is supportable; saying "go long" is not, and this project has already paid
// for the difference several times.
function formatStructureAlert({ alert, daily, fourHour }) {
  const up = alert.direction === 'bullish';
  const arrow = up ? '🟢' : '🔴';
  // Alignment is derived here rather than read from alert.aligned. A caller
  // passing aligned:true while the biases actually disagree would otherwise
  // print "searah dengan bias 1D" directly above "⚠️ konflik" in the same
  // message — the formatter should not be able to contradict itself.
  const alignedWithDaily = alert.timeframe !== '1D' && daily.bias === alert.direction;
  const lines = [
    `${arrow} <b>BTC break of structure — ${alert.timeframe} ${up ? 'BULLISH' : 'BEARISH'}</b>`,
    `Close ${alert.close} ${up ? 'menembus' : 'menembus ke bawah'} swing ${alert.level}` +
    `${alignedWithDaily ? ' · searah dengan bias 1D' : ''}`,
    '',
    `Struktur sekarang — 1D: <b>${daily.bias ? daily.bias.toUpperCase() : 'UNKNOWN'}</b>` +
    ` · 4H: <b>${fourHour.bias ? fourHour.bias.toUpperCase() : 'UNKNOWN'}</b>` +
    `${daily.bias && fourHour.bias && daily.bias !== fourHour.bias ? ' ⚠️ konflik' : ''}`,
  ];

  lines.push(
    '',
    up
      ? '📌 Artinya untuk posisi: sinyal long dapat dukungan struktur. BUKAN entry — level di atas cuma penanda struktur, bukan setup.'
      : '📌 Artinya untuk posisi: hati-hati menambah long baru, dan cek ulang stop posisi yang jalan. BUKAN sinyal short.',
    `<i>Diukur: gerak setelah BOS ${alert.timeframe} BTC tidak beda dari noise (|t| &lt; 1.7, n=27-44). ` +
    'Ini konteks, bukan edge — lihat data/crypto-signal-validation.md.</i>',
  );
  return lines.join('\n');
}

function formatDailyReminder({ macroEvents, earningsTomorrow, tokenUnlocksTomorrow, dateYmd }) {
  if (!macroEvents.length && !earningsTomorrow.length && !tokenUnlocksTomorrow.length) return null;
  const lines = [`🗓️ <b>H-1 Reminder untuk ${dateYmd}</b>`];

  if (macroEvents.length) {
    lines.push('', '<b>Macro events:</b>');
    for (const e of macroEvents) {
      // e.time is Eastern, not UTC, despite Nasdaq naming the field `gmt` —
      // see src/time.js. dateYmd is the event's own date, needed to resolve
      // EDT vs EST for that day.
      lines.push(`• ${escapeHtml(withEtAndWib(e.time, dateYmd))} — ${escapeHtml(e.name)}${e.consensus && e.consensus.trim() ? ` (consensus ${escapeHtml(e.consensus)})` : ''}`);
    }
  }

  if (earningsTomorrow.length) {
    lines.push('', '<b>Earnings:</b>');
    for (const e of earningsTomorrow) {
      lines.push(`• ${escapeHtml(e.symbol)} — ${escapeHtml(e.name || '')}`.trim());
    }
  }

  if (tokenUnlocksTomorrow.length) {
    lines.push('', '<b>Token unlocks:</b>');
    for (const u of tokenUnlocksTomorrow) {
      lines.push(`• ${escapeHtml(u.symbol)}${u.note ? ` — ${escapeHtml(u.note)}` : ''}`);
    }
  }

  return lines.join('\n');
}

module.exports = { formatStockAlert, formatCryptoAlert, formatDailyReminder, formatStructureAlert };
