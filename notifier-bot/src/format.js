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

function newsLines(news) {
  if (!news?.length) return [];
  return [
    '',
    '📰 News:',
    ...news.map((n) => (n.link ? `• <a href="${escapeHtml(n.link)}">${escapeHtml(n.title)}</a>` : `• ${escapeHtml(n.title)}`)),
  ];
}

function convictionLine(conviction) {
  if (!conviction) return null;
  return `${conviction.emoji} Conviction: <b>${conviction.label}</b> — <i>${escapeHtml(conviction.reason)}</i>`;
}

// The measured-performance block. This replaces the conviction *label* as the
// headline, because a label is a summary of these numbers and the numbers are
// what a decision actually needs: how much this setup has returned per trade,
// on how many samples, versus what a coin flip returned on the same data.
//
// The random baseline is on the same line as the expectancy deliberately. An
// avgR of +0.19 reads as good until you see that random entries on the same
// bigcap pairs returned +0.23 over the same window.
function statsLines(stats, plan) {
  if (!stats) return [];
  const pct = expectancyPercent(stats.avgR, plan?.stopDistancePercent);
  const rr = stats.rr === null ? '—' : stats.rr.toFixed(2);
  const scope = stats.capTier === 'all' ? '' : ` (${stats.capTier})`;
  const lines = [
    `📊 <b>${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(3)}R/trade</b>` +
    `${pct !== null ? ` ≈ ${pct >= 0 ? '+' : ''}${pct}%` : ''} · ` +
    `WR ${stats.winRate}% · RR ${rr} · n=${stats.n}${scope}`,
  ];
  if (stats.randomBaseline !== null && stats.randomBaseline !== undefined) {
    const edge = Math.round((stats.avgR - stats.randomBaseline) * 1000) / 1000;
    lines.push(
      `   vs entry acak ${stats.randomBaseline >= 0 ? '+' : ''}${stats.randomBaseline}R ` +
      `→ <b>${edge >= 0 ? '+' : ''}${edge}R</b> · rank #${stats.rank}/${stats.of}`,
    );
  }
  lines.push(`⏱ Exit: stop atau <b>${stats.holdDays} hari</b> (bukan di Ref level)`);
  return lines;
}

function regimeLine(regime, conviction) {
  if (!regime) return null;
  const base = `${REGIME_EMOJI[regime] || ''} Regime: <b>${REGIME_LABEL[regime] || regime}</b> (BTC 200SMA)`;
  if (!conviction?.regimeAdjusted) return base;
  const ev = conviction.regimeEvidence;
  const dir = ev.adjust > 0 ? 'naik' : 'turun';
  return `${base} → conviction ${dir} 1 tier ` +
    `<i>(${ev.avgR >= 0 ? '+' : ''}${ev.avgR}R di regime ini, n=${ev.n})</i>`;
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

// Leverage/sizing block. Deliberately leads with max leverage rather than a
// suggested position size: the number people get wrong is the leverage, and
// it is derived from this specific setup's stop width, not chosen by feel.
function positionLines(position) {
  if (!position) return [];
  const lines = ['', '⚙️ <b>Position plan</b>'];
  lines.push(
    `Max aman ${position.maxSafeLeverage}x → pakai <b>${position.suggestedLeverage}x</b> ` +
    `(likuidasi ~${position.liquidationMovePercent}% = ${position.liquidationVsStop}x jarak stop)`,
  );
  if (position.margin != null) {
    lines.push(
      `Risk ${position.riskAmount} | Notional ${position.notional} | Margin ${position.margin} ` +
      `(${position.marginPercentOfAccount}% akun)`,
    );
  } else {
    lines.push(`Notional = ${position.notionalPerUnitRisk}x jumlah yang kamu risk-kan (set ACCOUNT_SIZE di .env buat angka konkret)`);
  }
  if (position.fundingHoldCostR != null) {
    lines.push(`Funding 7 hari ≈ ${position.fundingHoldCostPercent}% = ${position.fundingHoldCostR}R`);
  }
  for (const w of position.warnings || []) lines.push(`⚠️ ${escapeHtml(w)}`);
  return lines;
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
function formatCryptoAlert({
  symbol, signal, plan, news, conviction, provisional, rareTier, position, stats, regime, why,
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
    `Entry <b>${plan.entry}</b> | Stop <b>${plan.stop}</b> | jarak ${Number(plan.stopDistancePercent).toFixed(2)}% | Ref ${plan.target}`,
    ...positionLines(position),
    ...newsLines(news),
    '',
    '<i>Harga via OKX — cek di venue kamu sebelum entry.</i>',
  ];
  return lines.filter((l) => l !== null).join('\n');
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

module.exports = { formatStockAlert, formatCryptoAlert, formatDailyReminder };
