import Parser from 'rss-parser';
import type { NewsItem } from '../../types/news.js';
import type { Source } from '../../config/sources.schema.js';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent':
      'YouTravelMarketingAgent/0.1 (+https://youtravel.me) Mozilla/5.0',
  },
});

function pickImage(item: Parser.Item & Record<string, unknown>): string | undefined {
  const enclosure = item.enclosure;
  if (enclosure && typeof enclosure.url === 'string') return enclosure.url;

  const mediaContent = item['media:content'] as
    | { $?: { url?: string } }
    | undefined;
  if (mediaContent?.$?.url) return mediaContent.$.url;

  const mediaThumbnail = item['media:thumbnail'] as
    | { $?: { url?: string } }
    | undefined;
  if (mediaThumbnail?.$?.url) return mediaThumbnail.$.url;

  const content = item['content:encoded'] ?? item.content;
  if (typeof content === 'string') {
    const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match) return match[1];
  }

  return undefined;
}

export async function fetchRss(source: Source): Promise<NewsItem[]> {
  const feed = await parser.parseURL(source.url);
  const items = feed.items ?? [];

  const results: NewsItem[] = [];
  for (const item of items) {
    if (!item.link || !item.title) continue;

    const text =
      (item.contentSnippet as string | undefined) ??
      (item.content as string | undefined) ??
      undefined;

    let publishedAt: string | undefined;
    if (item.isoDate) publishedAt = item.isoDate;
    else if (item.pubDate) {
      const parsed = new Date(item.pubDate);
      if (!Number.isNaN(parsed.getTime())) publishedAt = parsed.toISOString();
    }

    const news: NewsItem = {
      title: item.title.trim(),
      url: item.link,
      sourceName: source.name,
      sourceId: source.id,
      language: source.language,
    };

    if (publishedAt) news.publishedAt = publishedAt;
    if (text) news.summary = text.slice(0, 1200);
    const image = pickImage(item);
    if (image) news.imageUrl = image;

    results.push(news);
  }

  return results;
}
