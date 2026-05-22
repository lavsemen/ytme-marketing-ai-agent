import { logger } from '../../utils/logger.js';
import type { NewsItem } from '../../types/news.js';
import type { Source } from '../../config/sources.schema.js';
import { fetchRss } from './rssFetcher.js';
import { fetchHtmlNews } from './htmlFetcher.js';
import { dedupeNews, filterRecent } from './dedupe.js';

function looksLikeRss(url: string): boolean {
  return /\.(xml|rss|atom)(\?|$)/i.test(url) || /\/(rss|feed|atom)/i.test(url);
}

async function fetchOne(source: Source): Promise<NewsItem[]> {
  const log = logger.child({ source: source.id });
  const type =
    source.type === 'auto' ? (looksLikeRss(source.url) ? 'rss' : 'html') : source.type;

  log.info({ type, url: source.url }, 'Fetching source');

  try {
    if (type === 'rss') return await fetchRss(source);
    return await fetchHtmlNews(source);
  } catch (err) {
    log.warn({ err }, 'Source fetch failed');
    if (type === 'rss') {
      log.info('Falling back to HTML fetcher');
      try {
        return await fetchHtmlNews(source);
      } catch (err2) {
        log.warn({ err: err2 }, 'HTML fallback also failed');
        return [];
      }
    }
    return [];
  }
}

export interface FetchNewsOptions {
  maxAgeDays?: number;
  maxPerSource?: number;
  overallLimit?: number;
}

export async function fetchAllNews(
  sources: Source[],
  options: FetchNewsOptions = {},
): Promise<NewsItem[]> {
  const enabled = sources.filter((s) => s.enabled);
  if (enabled.length === 0) {
    logger.warn('No enabled sources to fetch');
    return [];
  }

  const perSource = options.maxPerSource ?? 5;
  const overall = options.overallLimit ?? 30;

  const all: NewsItem[] = [];
  for (const source of enabled) {
    const items = await fetchOne(source);
    all.push(...items.slice(0, perSource));
  }

  const deduped = dedupeNews(all);
  const recent = filterRecent(deduped, options.maxAgeDays ?? 14);
  return recent.slice(0, overall);
}
