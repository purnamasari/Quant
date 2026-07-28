// Minimal RSS reader (regex-based, no XML parser dependency — good enough
// for well-formed <item><title>/<link> blocks from Yahoo/Google News).
// Stock news: Yahoo Finance per-symbol feed (same endpoint used by
// purnamasari/quant's news.ts). Crypto news: Google News RSS search by
// coin name (same pattern as googleNews.ts in the main app).

function decodeEntities(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseRssItems(xml, limit) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) && items.length < limit) {
    const block = match[1];
    const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(block);
    const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(block);
    if (!titleMatch) continue;
    items.push({
      title: decodeEntities(titleMatch[1]),
      link: linkMatch ? decodeEntities(linkMatch[1]) : null,
    });
  }
  return items;
}

async function getStockNews(symbol, limit = 2) {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssItems(xml, limit);
  } catch (err) {
    console.error(`[news] stock ${symbol} failed:`, err.message);
    return [];
  }
}

async function getCryptoNews(query, limit = 2) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssItems(xml, limit);
  } catch (err) {
    console.error(`[news] crypto "${query}" failed:`, err.message);
    return [];
  }
}

module.exports = { getStockNews, getCryptoNews };
