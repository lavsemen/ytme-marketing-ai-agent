import type { CatalogPage } from '../../types/catalogPage.js';
import type { TravelInsight } from '../../types/insight.js';
import {
  countStemMatches,
  detectCitiesInText,
  extractInsightKeywords,
  normalizeText,
  stemText,
  stemToken,
} from '../tours/insightKeywords.js';

export interface RankCollectionsOptions {
  minScore?: number;
  maxRelated?: number;
  hint?: string;
}

export interface RankCollectionsResult {
  primary: CatalogPage | null;
  related: CatalogPage[];
  score: number;
  debug: Array<{ title: string; url: string; score: number }>;
}

const CATALOG_TARGET_PURPOSE = 'Целевая страница каталога';

function norm(s: string | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

function pageHaystack(page: CatalogPage): string {
  return stemText([page.title, page.url, page.purpose, page.pageClass, page.pageType].join(' '));
}

function geoScore(page: CatalogPage, insight: TravelInsight): number {
  const hay = pageHaystack(page);
  let score = 0;

  const country = norm(insight.country);
  if (country && country !== 'unknown') {
    const countryStem = stemToken(normalizeText(country));
    if (countryStem && hay.includes(countryStem)) score += 20;
  }

  const region = norm(insight.region);
  if (region) {
    const regionStem = stemToken(normalizeText(region));
    if (regionStem && hay.includes(regionStem)) score += 12;
  }

  const city = norm(insight.city);
  if (city) {
    const cityStem = stemToken(normalizeText(city));
    if (cityStem && hay.includes(cityStem)) score += 15;
  }

  return score;
}

function topicScore(page: CatalogPage, insight: TravelInsight, hint?: string): number {
  const keywords = extractInsightKeywords(insight);
  const hay = pageHaystack(page);
  let score = 0;

  for (const s of keywords.primary) {
    score += countStemMatches(hay, [s]) * 4;
  }
  for (const s of keywords.secondary) {
    score += countStemMatches(hay, [s]) * 2;
  }

  const detected = detectCitiesInText(insight.shortSummary, insight.country);
  for (const loc of detected) {
    const stem = stemToken(normalizeText(loc));
    if (stem && hay.includes(stem)) score += 6;
  }

  if (hint?.trim()) {
    const hintStems = stemText(hint).split(/\s+/).filter(Boolean);
    for (const s of hintStems) {
      if (hay.includes(s)) score += 3;
    }
  }

  return Math.min(score, 40);
}

function purposeBonus(page: CatalogPage): number {
  if (page.purpose === CATALOG_TARGET_PURPOSE) return 8;
  if (page.pageType === 'SEO-фильтр') return 3;
  return 0;
}

function tourCountBonus(page: CatalogPage): number {
  if (page.tourCount === undefined) return 0;
  if (page.tourCount >= 50) return 4;
  if (page.tourCount >= 10) return 2;
  if (page.tourCount >= 1) return 1;
  return 0;
}

function scorePage(page: CatalogPage, insight: TravelInsight, hint?: string): number {
  return (
    geoScore(page, insight) +
    topicScore(page, insight, hint) +
    purposeBonus(page) +
    tourCountBonus(page)
  );
}

export function rankCollections(
  pages: CatalogPage[],
  insight: TravelInsight,
  options: RankCollectionsOptions = {},
): RankCollectionsResult {
  const minScore = options.minScore ?? 12;
  const maxRelated = options.maxRelated ?? 8;

  const scored = pages
    .map((page) => ({ page, score: scorePage(page, insight, options.hint) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const debug = scored.slice(0, 10).map((s) => ({
    title: s.page.title,
    url: s.page.url,
    score: s.score,
  }));

  if (scored.length === 0 || scored[0]!.score < minScore) {
    return { primary: null, related: [], score: scored[0]?.score ?? 0, debug };
  }

  const primary = scored[0]!.page;
  const seen = new Set<string>([primary.url]);
  const related: CatalogPage[] = [];

  for (const item of scored.slice(1)) {
    if (related.length >= maxRelated) break;
    if (seen.has(item.page.url)) continue;
    seen.add(item.page.url);
    related.push(item.page);
  }

  if (related.length === 0) {
    related.push(primary);
  }

  return {
    primary,
    related,
    score: scored[0]!.score,
    debug,
  };
}
