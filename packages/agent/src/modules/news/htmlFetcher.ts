import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import * as cheerio from 'cheerio';
import { request } from 'undici';
import type { NewsItem } from '../../types/news.js';
import type { Source } from '../../config/sources.schema.js';

const USER_AGENT =
  'YouTravelMarketingAgent/0.1 (+https://youtravel.me) Mozilla/5.0';

interface FetchedHtml {
  html: string;
  finalUrl: string;
}

async function fetchHtml(url: string): Promise<FetchedHtml> {
  const res = await request(url, {
    method: 'GET',
    headersTimeout: 15000,
    bodyTimeout: 30000,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ru,en;q=0.8',
    },
  });

  if (res.statusCode < 200 || res.statusCode >= 400) {
    throw new Error(`HTTP ${res.statusCode} for ${url}`);
  }

  const html = await res.body.text();
  return { html, finalUrl: url };
}

function absoluteUrl(base: string, maybeRelative: string | undefined): string | undefined {
  if (!maybeRelative) return undefined;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return undefined;
  }
}

function extractLinks(html: string, baseUrl: string, limit: number): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const out: string[] = [];

  const baseHost = (() => {
    try {
      return new URL(baseUrl).host;
    } catch {
      return '';
    }
  })();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const abs = absoluteUrl(baseUrl, href);
    if (!abs) return;

    let host = '';
    try {
      host = new URL(abs).host;
    } catch {
      return;
    }
    if (host !== baseHost) return;

    const path = new URL(abs).pathname;
    if (path === '/' || path === '') return;
    if (/\.(jpg|jpeg|png|gif|webp|svg|css|js|pdf|ico)$/i.test(path)) return;

    if (seen.has(abs)) return;
    seen.add(abs);
    out.push(abs);
    if (out.length >= limit) return false;
    return undefined;
  });

  return out;
}

function extractArticle(html: string, url: string): {
  title?: string;
  text?: string;
  imageUrl?: string;
  publishedAt?: string;
} {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const $ = cheerio.load(html);
  const ogImage = $('meta[property="og:image"]').attr('content');
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogPublished =
    $('meta[property="article:published_time"]').attr('content') ??
    $('meta[name="pubdate"]').attr('content') ??
    $('meta[name="date"]').attr('content');

  const result: {
    title?: string;
    text?: string;
    imageUrl?: string;
    publishedAt?: string;
  } = {};

  if (article?.title || ogTitle) result.title = article?.title ?? ogTitle;
  if (article?.textContent) {
    result.text = article.textContent.trim().slice(0, 4000);
  }
  if (ogImage) {
    const abs = absoluteUrl(url, ogImage);
    if (abs) result.imageUrl = abs;
  }
  if (ogPublished) {
    const parsed = new Date(ogPublished);
    if (!Number.isNaN(parsed.getTime())) {
      result.publishedAt = parsed.toISOString();
    }
  }

  return result;
}

export async function fetchHtmlNews(
  source: Source,
  options: { maxArticles?: number } = {},
): Promise<NewsItem[]> {
  const maxArticles = options.maxArticles ?? 5;

  const index = await fetchHtml(source.url);
  const links = extractLinks(index.html, source.url, maxArticles * 3);

  const results: NewsItem[] = [];
  for (const link of links) {
    if (results.length >= maxArticles) break;
    try {
      const page = await fetchHtml(link);
      const extracted = extractArticle(page.html, page.finalUrl);
      if (!extracted.title || !extracted.text || extracted.text.length < 200) {
        continue;
      }

      const news: NewsItem = {
        title: extracted.title.trim(),
        url: page.finalUrl,
        sourceName: source.name,
        sourceId: source.id,
        language: source.language,
        summary: extracted.text.slice(0, 1200),
        text: extracted.text,
      };
      if (extracted.imageUrl) news.imageUrl = extracted.imageUrl;
      if (extracted.publishedAt) news.publishedAt = extracted.publishedAt;
      results.push(news);
    } catch {
      continue;
    }
  }

  return results;
}
