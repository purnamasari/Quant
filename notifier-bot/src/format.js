function toneEmoji(tone) {
  if (tone === 'hot') return '🔥';
  if (tone === 'watch') return '👀';
  return '📈';
}

function formatStockAlert({ symbol, name, signal, plan, earningsWarning }) {
  const lines = [
    `${toneEmoji(signal.tone)} <b>${symbol}</b> — ${signal.label}`,
    name ? `<i>${name}</i>` : null,
    signal.detail,
    '',
    `Entry ${plan.entry} | Stop ${plan.stop} | Target ${plan.target} | R:R ${plan.rewardRisk ?? '-'}`,
    `Stop distance: ${plan.stopDistancePercent}%`,
  ];
  if (earningsWarning) lines.push('', `⚠️ ${earningsWarning}`);
  return lines.filter(Boolean).join('\n');
}

function formatCryptoAlert({ symbol, signal, plan }) {
  const lines = [
    `${toneEmoji(signal.tone)} <b>${symbol}</b> (crypto) — ${signal.label}`,
    signal.detail,
    '',
    `Entry ${plan.entry} | Stop ${plan.stop} | Target ${plan.target} | R:R ${plan.rewardRisk ?? '-'}`,
    `Stop distance: ${plan.stopDistancePercent}%`,
    '',
    '<i>Price data via OKX (Binance unreachable from this job\'s network) — verify against your actual venue before entering.</i>',
  ];
  return lines.filter(Boolean).join('\n');
}

module.exports = { formatStockAlert, formatCryptoAlert };
