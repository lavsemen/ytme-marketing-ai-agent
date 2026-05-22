import type { NewsItem } from '../../types/news.js';

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[«»"'`’]/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const result: NewsItem[] = [];

  for (const item of items) {
    if (seenUrls.has(item.url)) continue;
    const titleKey = normalizeTitle(item.title);
    if (seenTitles.has(titleKey)) continue;

    seenUrls.add(item.url);
    seenTitles.add(titleKey);
    result.push(item);
  }

  return result;
}

export function filterRecent(
  items: NewsItem[],
  maxAgeDays = 14,
): NewsItem[] {
  const threshold = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    if (!item.publishedAt) return true;
    const ts = new Date(item.publishedAt).getTime();
    if (Number.isNaN(ts)) return true;
    return ts >= threshold;
  });
}
