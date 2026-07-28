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

function formatCryptoAlert({ symbol, signal, plan, news, conviction }) {
  const lines = [
    `${toneEmoji(signal.tone)} <b>${escapeHtml(symbol)}</b> (crypto) — ${escapeHtml(signal.label)} [${directionLabel(signal.direction)}]`,
    escapeHtml(signal.detail),
    convictionLine(conviction),
    '',
    `Entry ${plan.entry} | Stop ${plan.stop} | Target ${plan.target} | R:R ${plan.rewardRisk ?? '-'}`,
    `Stop distance: ${plan.stopDistancePercent}%`,
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
