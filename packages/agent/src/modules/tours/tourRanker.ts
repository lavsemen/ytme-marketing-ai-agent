import type { Tour } from '../../types/tour.js';
import type { TravelInsight } from '../../types/insight.js';

export interface RankOptions {
  minCount?: number;
  maxCount?: number;
}

interface ScoredTour {
  tour: Tour;
  score: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

function scoreTour(tour: Tour, insight: TravelInsight): number {
  let score = 0;

  if (norm(tour.country) === norm(insight.country)) score += 30;
  if (insight.region && norm(tour.region) === norm(insight.region)) score += 12;
  if (insight.city && norm(tour.city) === norm(insight.city)) score += 8;

  if (tour.rating != null) score += tour.rating * 4;
  if (tour.imageUrl) score += 6;
  if (tour.dates && tour.dates.length > 0) score += 4;
  if (tour.price) score += 3;
  if (tour.reviewsCount && tour.reviewsCount > 50) score += 2;

  if (insight.travelAngle) {
    const angle = norm(insight.travelAngle);
    const tags = (tour.tags ?? []).map(norm);
    if (tags.some((t) => angle.includes(t) || t.includes(angle.split(' ')[0] ?? ''))) {
      score += 3;
    }
  }

  return score;
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

export function rankTours(
  tours: Tour[],
  insight: TravelInsight,
  options: RankOptions = {},
): Tour[] {
  const minCount = options.minCount ?? 3;
  const maxCount = options.maxCount ?? 8;

  if (tours.length === 0) return [];

  const scored: ScoredTour[] = tours
    .map((tour) => ({ tour, score: scoreTour(tour, insight) }))
    .sort((a, b) => b.score - a.score);

  let selected = diversify(scored, maxCount);

  if (selected.length < minCount && tours.length >= minCount) {
    selected = scored.slice(0, minCount).map((s) => s.tour);
  }

  return selected;
}
