import Parser from 'rss-parser';
import type { NewsItem } from '../../types/news.js';
import type { Source } from '../../config/sources.schema.js';
import { NEWS_HTTP, NEWS_USER_AGENT } from './httpFetch.js';

const parser = new Parser({
  timeout: NEWS_HTTP.headersTimeoutMs,
  headers: {
    'User-Agent': NEWS_USER_AGENT,
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

export interface FetchRssOptions {
  signal?: AbortSignal;
}

export async function fetchRss(
  source: Source,
  options: FetchRssOptions = {},
): Promise<NewsItem[]> {
  if (options.signal?.aborted) {
    throw options.signal.reason ?? new Error('RSS fetch aborted');
  }

  const feed = await parser.parseURL(source.url);
  const items = feed.items ?? [];

  const results: NewsItem[] = [];
  for (const item of items) {
    if (options.signal?.aborted) break;
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
