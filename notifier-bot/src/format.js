// Telegram HTML parse_mode chokes on stray <, >, & in dynamic text (news
// headlines, signal detail strings) — escape before interpolating into
// hand-built tags like <a href="...">.
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const { withWib } = require('./time');

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

function formatCryptoAlert({ symbol, signal, plan, news, conviction, provisional, rareTier, position }) {
  const lines = [
    rareTier
      ? `⭐⭐⭐ <b>RARE HIGH-CONVICTION SETUP</b> — ${escapeHtml(symbol)} (crypto) — ${escapeHtml(signal.label)} + confluence [${directionLabel(signal.direction)}]`
      : `${toneEmoji(signal.tone)} <b>${escapeHtml(symbol)}</b> (crypto) — ${escapeHtml(signal.label)} [${directionLabel(signal.direction)}]`,
    provisional
      ? '🟡 <b>PROVISIONAL</b> — candle harian hari ini belum closing (cutoff 00:00 UTC), sinyal ini masih bisa berubah/hilang sebelum final.'
      : '🟢 <b>CONFIRMED</b> — dari candle harian yang sudah closing.',
    escapeHtml(signal.detail),
    convictionLine(conviction),
    rareTier
      ? '⏳ <b>Sabar, tahan sampai 7 hari</b> kalau belum kena stop/target — backtest edge ini diukur di hold 7 hari (67.8% WR, avg 0.497R, n=118), bukan hold 2 hari biasa. Ini kejadian langka (~1x per 6-10 hari), bukan alert harian.'
      : null,
    '',
    `Entry ${plan.entry} | Stop ${plan.stop} | Target ${plan.target} | R:R ${plan.rewardRisk ?? '-'}`,
    `Stop distance: ${plan.stopDistancePercent}%`,
    ...positionLines(position),
    ...newsLines(news),
    '',
    "<i>Price data via OKX (Binance unreachable from this job's network) — verify against your actual venue before entering.</i>",
  ];
  return lines.filter((l) => l !== null).join('\n');
}

function formatDailyReminder({ macroEvents, earningsTomorrow, tokenUnlocksTomorrow, dateYmd }) {
  if (!macroEvents.length && !earningsTomorrow.length && !tokenUnlocksTomorrow.length) return null;
  const lines = [`🗓️ <b>H-1 Reminder untuk ${dateYmd}</b>`];

  if (macroEvents.length) {
    lines.push('', '<b>Macro events:</b>');
    for (const e of macroEvents) {
      lines.push(`• ${escapeHtml(withWib(e.time))} — ${escapeHtml(e.name)}${e.consensus && e.consensus.trim() ? ` (consensus ${escapeHtml(e.consensus)})` : ''}`);
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
