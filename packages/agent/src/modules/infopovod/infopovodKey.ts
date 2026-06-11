import type { TravelInsight } from '../../types/insight.js';
import type { NewsItem } from '../../types/news.js';

/** Normalize a news title for dedup — same topic from different sources/URLs maps to one key. */
export function normalizeInfopovodTitle(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[«»"'`""''„]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function infopovodKeyForInsight(insight: TravelInsight, news: NewsItem[]): string {
  const matched = news.find((n) => n.url === insight.sourceUrl);
  return normalizeInfopovodTitle(matched?.title ?? insight.title);
}
