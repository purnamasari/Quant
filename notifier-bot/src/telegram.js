const config = require('./config');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiUrl(method) {
  return `https://api.telegram.org/bot${config.telegramBotToken}/${method}`;
}

async function sendMessage(text, { replyMarkup, attempt = 1 } = {}) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.warn('[telegram] missing TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID, skipping send:\n', text);
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch(apiUrl('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        ...(config.telegramThreadId ? { message_thread_id: config.telegramThreadId } : {}),
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
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
      return sendMessage(text, { replyMarkup, attempt: attempt + 1 });
    }
    console.error(`[telegram] send failed after ${attempt} attempts:`, err.message);
    return { ok: false, error: err.message };
  }
}

async function sendPhoto(photoBuffer, caption, { replyMarkup, attempt = 1 } = {}) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.warn('[telegram] missing TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID, skipping photo send');
    return { ok: false, skipped: true };
  }
  try {
    const form = new FormData();
    form.append('chat_id', config.telegramChatId);
    if (config.telegramThreadId) form.append('message_thread_id', config.telegramThreadId);
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
    }
    if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
    form.append('photo', new Blob([photoBuffer], { type: 'image/png' }), 'chart.png');

    const res = await fetch(apiUrl('sendPhoto'), { method: 'POST', body: form });
    const json = await res.json();
    if (!json.ok) console.error('[telegram] sendPhoto failed:', json);
    return json;
  } catch (err) {
    if (attempt < 3) {
      console.warn(`[telegram] sendPhoto attempt ${attempt} failed (${err.message}), retrying...`);
      await sleep(1500 * attempt);
      return sendPhoto(photoBuffer, caption, { replyMarkup, attempt: attempt + 1 });
    }
    console.error(`[telegram] sendPhoto failed after ${attempt} attempts:`, err.message);
    return { ok: false, error: err.message };
  }
}

// Sends several photos as ONE album (media group). Telegram renders them side
// by side and shows the caption only on the first photo. Used by the Monday
// daily-bias message, which carries both the weekly (1D) and intraday (4H)
// forecast charts in a single message.
async function sendMediaGroup(photos, caption, { attempt = 1 } = {}) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.warn('[telegram] missing TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID, skipping album send');
    return { ok: false, skipped: true };
  }
  try {
    const form = new FormData();
    form.append('chat_id', config.telegramChatId);
    if (config.telegramThreadId) form.append('message_thread_id', config.telegramThreadId);
    // Each photo is attached under its own field (photo0, photo1, ...) and
    // referenced from the media array as attach://photoN.
    const media = photos.map((p, i) => {
      const item = { type: 'photo', media: `attach://photo${i}` };
      if (i === 0 && caption) {
        item.caption = caption;
        item.parse_mode = 'HTML';
      }
      return item;
    });
    form.append('media', JSON.stringify(media));
    photos.forEach((p, i) => {
      form.append(`photo${i}`, new Blob([p], { type: 'image/png' }), `chart${i}.png`);
    });

    const res = await fetch(apiUrl('sendMediaGroup'), { method: 'POST', body: form });
    const json = await res.json();
    if (!json.ok) console.error('[telegram] sendMediaGroup failed:', json);
    return json;
  } catch (err) {
    if (attempt < 3) {
      console.warn(`[telegram] sendMediaGroup attempt ${attempt} failed (${err.message}), retrying...`);
      await sleep(1500 * attempt);
      return sendMediaGroup(photos, caption, { attempt: attempt + 1 });
    }
    console.error(`[telegram] sendMediaGroup failed after ${attempt} attempts:`, err.message);
    return { ok: false, error: err.message };
  }
}

// Long-poll-style single fetch (not a persistent loop) — the bot is a
// cron job, not a server, so this is called once at the start of each
// run to pick up any button presses (callback_query) since the last
// offset. Telegram queues updates server-side until acknowledged, so
// nothing is lost between runs, it's just not real-time.
async function getUpdates(offset) {
  if (!config.telegramBotToken) return [];
  const url = new URL(apiUrl('getUpdates'));
  url.searchParams.set('timeout', '0');
  if (offset != null) url.searchParams.set('offset', String(offset));
  try {
    const res = await fetch(url);
    const json = await res.json();
    return json.ok ? json.result : [];
  } catch (err) {
    console.error('[telegram] getUpdates failed:', err.message);
    return [];
  }
}

async function answerCallbackQuery(callbackQueryId, text) {
  if (!config.telegramBotToken) return;
  try {
    await fetch(apiUrl('answerCallbackQuery'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
    });
  } catch (err) {
    console.error('[telegram] answerCallbackQuery failed:', err.message);
  }
}

module.exports = { sendMessage, sendPhoto, sendMediaGroup, getUpdates, answerCallbackQuery };
