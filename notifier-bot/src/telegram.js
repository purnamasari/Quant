const config = require('./config');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendMessage(text, attempt = 1) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.warn('[telegram] missing TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID, skipping send:\n', text);
    return { ok: false, skipped: true };
  }
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const json = await res.json();
    if (!json.ok) console.error('[telegram] send failed:', json);
    return json;
  } catch (err) {
    // Transient DNS/network blips happen; don't let one failed message
    // abort the whole job's remaining alerts.
    if (attempt < 3) {
      console.warn(`[telegram] send attempt ${attempt} failed (${err.message}), retrying...`);
      await sleep(1500 * attempt);
      return sendMessage(text, attempt + 1);
    }
    console.error(`[telegram] send failed after ${attempt} attempts:`, err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendMessage };
