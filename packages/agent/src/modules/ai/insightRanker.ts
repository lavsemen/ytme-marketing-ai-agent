import type { TravelInsight } from '../../types/insight.js';
import type {
  GeoSettings,
  SeasonalPrioritiesSettings,
  MonthRangeKey,
} from '../../config/agentConfig.js';

const GEO_PRIORITY_BONUS = 0.1;
const SEASONAL_BONUS = 0.15;

function normalize(s: string | undefined | null): string {
  return (s ?? '').toLowerCase().trim();
}

/** Filters out insights whose country is in geo.blocked. */
export function filterBlocked(
  insights: TravelInsight[],
  blocked: string[],
): { kept: TravelInsight[]; dropped: TravelInsight[] } {
  if (blocked.length === 0) return { kept: insights, dropped: [] };
  const blockedSet = new Set(blocked.map(normalize));
  const kept: TravelInsight[] = [];
  const dropped: TravelInsight[] = [];
  for (const ins of insights) {
    if (blockedSet.has(normalize(ins.country))) dropped.push(ins);
    else kept.push(ins);
  }
  return { kept, dropped };
}

/**
 * Returns a shallow-cloned insights array with confidenceScore boosted for prioritized
 * and seasonal countries. The boost is clamped to [0, 1].
 */
export function boostInsights(
  insights: TravelInsight[],
  options: {
    geo: GeoSettings;
    seasonal: SeasonalPrioritiesSettings;
    bucket: MonthRangeKey;
  },
): TravelInsight[] {
  const prioritized = new Set(options.geo.prioritized.map(normalize));
  const seasonal = new Set(options.seasonal[options.bucket].map(normalize));

  return insights.map((ins) => {
    const country = normalize(ins.country);
    let bonus = 0;
    if (prioritized.has(country)) bonus += GEO_PRIORITY_BONUS;
    if (seasonal.has(country)) bonus += SEASONAL_BONUS;
    if (bonus === 0) return ins;
    return {
      ...ins,
      confidenceScore: Math.min(1, ins.confidenceScore + bonus),
    };
  });
}
