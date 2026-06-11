import { logger } from '../../utils/logger.js';
import type { NewsItem } from '../../types/news.js';
import type { Source } from '../../config/sources.schema.js';
import { fetchRss } from './rssFetcher.js';
import { fetchHtmlNews } from './htmlFetcher.js';
import { dedupeNews, filterRecent } from './dedupe.js';
import {
  isFetchAbortError,
  mapWithConcurrency,
  NEWS_HTTP,
  withSourceDeadline,
} from './httpFetch.js';

function looksLikeRss(url: string): boolean {
  return /\.(xml|rss|atom)(\?|$)/i.test(url) || /\/(rss|feed|atom)/i.test(url);
}

async function fetchOne(source: Source): Promise<NewsItem[]> {
  return withSourceDeadline(source.id, NEWS_HTTP.sourceDeadlineMs, async (signal) => {
    const log = logger.child({ source: source.id });
    const type =
      source.type === 'auto' ? (looksLikeRss(source.url) ? 'rss' : 'html') : source.type;

    log.info({ type, url: source.url }, 'Fetching source');

    try {
      if (type === 'rss') return await fetchRss(source, { signal });
      return await fetchHtmlNews(source, { signal });
    } catch (err) {
      if (isFetchAbortError(err)) {
        log.warn(
          { err: err instanceof Error ? err.message : String(err) },
          'Source fetch timed out (skipped)',
        );
        return [];
      }
      log.warn({ err }, 'Source fetch failed');
      if (type === 'rss' && !signal.aborted) {
        log.info('Falling back to HTML fetcher');
        try {
          return await fetchHtmlNews(source, { signal });
        } catch (err2) {
          if (isFetchAbortError(err2)) {
            log.warn('HTML fallback timed out (skipped)');
            return [];
          }
          log.warn({ err: err2 }, 'HTML fallback also failed');
          return [];
        }
      }
      return [];
    }
  });
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

  const batches = await mapWithConcurrency(
    enabled,
    NEWS_HTTP.sourceConcurrency,
    async (source) => {
      try {
        return await fetchOne(source);
      } catch (err) {
        logger.warn(
          { source: source.id, err: err instanceof Error ? err.message : String(err) },
          'Source fetch failed unexpectedly',
        );
        return [] as NewsItem[];
      }
    },
  );

  const all: NewsItem[] = [];
  for (const items of batches) {
    all.push(...items.slice(0, perSource));
  }

  const deduped = dedupeNews(all);
  const recent = filterRecent(deduped, options.maxAgeDays ?? 14);
  logger.info(
    {
      sources: enabled.length,
      raw: all.length,
      deduped: deduped.length,
      recent: recent.length,
    },
    'News fetch complete',
  );
  return recent.slice(0, overall);
}
