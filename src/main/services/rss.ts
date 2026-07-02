// RSS 2.0 parsing shared by the Yahoo per-ticker feed and Google News.
// fast-xml-parser with isArray for <item> so single-item channels still
// come back as arrays. Titles are kept as raw strings (parseTagValue off)
// so headlines like "3M" don't get coerced to numbers.

import { XMLParser } from 'fast-xml-parser';

export interface RssItem {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  /** Publisher from the <source> tag when present (Google News has it). */
  sourceName?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => name === 'item',
  parseTagValue: false,
  trimValues: true,
});

function textOf(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const text = (value as Record<string, unknown>)['#text'];
    if (typeof text === 'string') return text.trim();
    if (typeof text === 'number') return String(text);
  }
  return '';
}

/** Parse an RSS 2.0 document into normalized items. Bad XML → []. */
export function parseRssItems(xml: string): RssItem[] {
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  const channel = (doc as { rss?: { channel?: { item?: unknown } } }).rss?.channel;
  const rawItems = channel?.item;
  if (!Array.isArray(rawItems)) return [];

  const out: RssItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const title = textOf(item.title);
    const link = textOf(item.link);
    if (!title || !link) continue;
    const pubDate = textOf(item.pubDate);
    const description = textOf(item.description);
    const sourceName = textOf(item.source);
    out.push({
      title,
      link,
      pubDate: pubDate || undefined,
      description: description || undefined,
      sourceName: sourceName || undefined,
    });
  }
  return out;
}
