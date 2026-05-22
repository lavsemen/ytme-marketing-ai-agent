import type { Tour } from '../../types/tour.js';
import type { TravelInsight } from '../../types/insight.js';
import {
  countStemMatches,
  detectCitiesInText,
  extractInsightKeywords,
  normalizeText,
  stemText,
  stemToken,
  type InsightKeywords,
} from './insightKeywords.js';

export interface RankOptions {
  minCount?: number;
  maxCount?: number;
}

interface ScoreBreakdown {
  geo: number;
  quality: number;
  topic: number;
  locationBoost: number;
  topicPrimaryHits: number;
  topicSecondaryHits: number;
  total: number;
}

interface ScoredTour {
  tour: Tour;
  score: ScoreBreakdown;
}

function norm(s: string | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

/**
 * Per-stem topic match in (tags, title, shortDescription). Tags carry the
 * most weight because they come from the explicit tour categories.
 */
function computeTopicScore(tour: Tour, keywords: InsightKeywords): {
  topic: number;
  primaryHits: number;
  secondaryHits: number;
} {
  // Pre-stem each haystack once — `countStemMatches` itself only normalizes
  // (no stemming), so we feed it already-stemmed text. This keeps matching
  // morphology-aware ("термальный" tag matches keyword "терма").
  const tagsText = stemText((tour.tags ?? []).join(' '));
  const titleText = stemText(tour.title ?? '');
  const descText = stemText(tour.shortDescription ?? '');

  let primaryScore = 0;
  let primaryHits = 0;
  for (const s of keywords.primary) {
    const inTags = countStemMatches(tagsText, [s]);
    const inTitle = countStemMatches(titleText, [s]);
    const inDesc = countStemMatches(descText, [s]);
    if (inTags + inTitle + inDesc > 0) primaryHits += 1;
    primaryScore += inTags * 4 + inTitle * 3 + inDesc * 1;
  }
  primaryScore = Math.min(primaryScore, 24);

  let secondaryScore = 0;
  let secondaryHits = 0;
  for (const s of keywords.secondary) {
    const inTags = countStemMatches(tagsText, [s]);
    const inTitle = countStemMatches(titleText, [s]);
    if (inTags + inTitle > 0) secondaryHits += 1;
    secondaryScore += inTags * 2 + inTitle * 1;
  }
  secondaryScore = Math.min(secondaryScore, 8);

  return {
    topic: primaryScore + secondaryScore,
    primaryHits,
    secondaryHits,
  };
}

/**
 * Direct location boost: if the tour's `city`/`region`/`title` mentions any
 * of the destinations we detected in the news summary (or the explicit
 * insight.city), give it +10. This is the strongest signal short of an
 * exact country match — a tour explicitly in Pamukkale wins over a generic
 * Turkey-wide tour for a Pamukkale-themed news.
 */
function computeLocationBoost(
  tour: Tour,
  insight: TravelInsight,
  detectedLocations: string[],
): number {
  // Stem all candidate location names so we match across Russian declensions.
  const candidateStems = new Set<string>();
  for (const loc of detectedLocations) {
    const s = stemToken(normalizeText(loc));
    if (s) candidateStems.add(s);
  }
  if (insight.city) {
    const s = stemToken(normalizeText(insight.city));
    if (s) candidateStems.add(s);
  }
  if (candidateStems.size === 0) return 0;

  const haystack = stemText(
    [tour.city, tour.region, tour.title, tour.shortDescription].filter(Boolean).join(' '),
  );

  let boost = 0;
  let matched = 0;
  for (const stem of candidateStems) {
    if (haystack.includes(stem)) {
      matched += 1;
      if (matched === 1) boost += 10;
      else if (matched === 2) {
        boost += 4;
        break; // cap location boost at +14
      }
    }
  }
  return boost;
}

function scoreTour(
  tour: Tour,
  insight: TravelInsight,
  keywords: InsightKeywords,
): ScoreBreakdown {
  // Geo signal — country dominates, region/city refine.
  let geo = 0;
  if (norm(tour.country) === norm(insight.country)) geo += 30;
  if (insight.region && norm(tour.region) === norm(insight.region)) geo += 12;
  if (insight.city && norm(tour.city) === norm(insight.city)) geo += 8;

  // Quality signal — caps roughly at 35.
  let quality = 0;
  if (tour.rating != null) quality += tour.rating * 4;
  if (tour.imageUrl) quality += 6;
  if (tour.dates && tour.dates.length > 0) quality += 4;
  if (tour.price) quality += 3;
  if (tour.reviewsCount && tour.reviewsCount > 50) quality += 2;

  // Topic signal — caps at 32 (primary 24 + secondary 8).
  const topic = computeTopicScore(tour, keywords);

  // Location boost — caps at 14.
  const locationBoost = computeLocationBoost(tour, insight, keywords.detectedLocations);

  return {
    geo,
    quality,
    topic: topic.topic,
    locationBoost,
    topicPrimaryHits: topic.primaryHits,
    topicSecondaryHits: topic.secondaryHits,
    total: geo + quality + topic.topic + locationBoost,
  };
}

function diversify(scored: ScoredTour[], maxCount: number): Tour[] {
  const result: Tour[] = [];
  const usedTagSets = new Set<string>();

  for (const { tour } of scored) {
    if (result.length >= maxCount) break;
    const tagKey = (tour.tags ?? []).slice(0, 2).sort().join('|');
    if (tagKey && usedTagSets.has(tagKey) && result.length >= 3) {
      continue;
    }
    if (tagKey) usedTagSets.add(tagKey);
    result.push(tour);
  }

  if (result.length < maxCount) {
    for (const { tour } of scored) {
      if (result.length >= maxCount) break;
      if (!result.includes(tour)) result.push(tour);
    }
  }

  return result;
}

export interface RankedTourDebug {
  id: string;
  title: string;
  total: number;
  geo: number;
  quality: number;
  topic: number;
  locationBoost: number;
  topicPrimaryHits: number;
  topicSecondaryHits: number;
}

export interface RankToursResult {
  tours: Tour[];
  /** Top-N tours with score breakdown for logging/debugging. */
  debug: RankedTourDebug[];
  /** The keywords used for scoring (also useful for logging). */
  keywords: InsightKeywords;
}

/**
 * Score, sort, and diversify tours. Detailed variant that also returns
 * the score breakdown for the top-N tours and the extracted keywords.
 */
export function rankToursDetailed(
  tours: Tour[],
  insight: TravelInsight,
  options: RankOptions = {},
): RankToursResult {
  const minCount = options.minCount ?? 3;
  const maxCount = options.maxCount ?? 8;
  const keywords = extractInsightKeywords(insight);

  if (tours.length === 0) {
    return { tours: [], debug: [], keywords };
  }

  const scored: ScoredTour[] = tours
    .map((tour) => ({ tour, score: scoreTour(tour, insight, keywords) }))
    .sort((a, b) => b.score.total - a.score.total);

  let selected = diversify(scored, maxCount);

  if (selected.length < minCount && tours.length >= minCount) {
    selected = scored.slice(0, minCount).map((s) => s.tour);
  }

  const debug: RankedTourDebug[] = scored.slice(0, 5).map(({ tour, score }) => ({
    id: tour.id,
    title: tour.title,
    total: Math.round(score.total * 10) / 10,
    geo: Math.round(score.geo * 10) / 10,
    quality: Math.round(score.quality * 10) / 10,
    topic: Math.round(score.topic * 10) / 10,
    locationBoost: Math.round(score.locationBoost * 10) / 10,
    topicPrimaryHits: score.topicPrimaryHits,
    topicSecondaryHits: score.topicSecondaryHits,
  }));

  return { tours: selected, debug, keywords };
}

/**
 * Backwards-compatible thin wrapper.
 * Existing callers that only need the ranked tour list can keep using this.
 */
export function rankTours(
  tours: Tour[],
  insight: TravelInsight,
  options: RankOptions = {},
): Tour[] {
  return rankToursDetailed(tours, insight, options).tours;
}

// Re-export for callers that want to detect locations themselves
// (e.g. pipeline logging).
export { detectCitiesInText, extractInsightKeywords };
