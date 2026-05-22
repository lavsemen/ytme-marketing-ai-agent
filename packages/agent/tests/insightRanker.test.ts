import { describe, it, expect } from 'vitest';
import { boostInsights, filterBlocked } from '../src/modules/ai/insightRanker.js';
import type { TravelInsight } from '../src/types/insight.js';
import { DEFAULT_SETTINGS } from '../src/config/agentConfig.js';

function ins(country: string, confidence = 0.5): TravelInsight {
  return {
    title: `News about ${country}`,
    sourceUrl: `https://example.com/${country}`,
    sourceName: 'Test',
    shortSummary: 's',
    country,
    travelAngle: 'a',
    confidenceScore: confidence,
  };
}

describe('insightRanker', () => {
  describe('filterBlocked', () => {
    it('returns all insights when blocked list empty', () => {
      const r = filterBlocked([ins('Турция'), ins('Китай')], []);
      expect(r.kept.length).toBe(2);
      expect(r.dropped.length).toBe(0);
    });

    it('drops insights with blocked country (case-insensitive)', () => {
      const r = filterBlocked([ins('Турция'), ins('КНДР'), ins('кндр')], ['КНДР']);
      expect(r.kept.map((i) => i.country)).toEqual(['Турция']);
      expect(r.dropped.length).toBe(2);
    });
  });

  describe('boostInsights', () => {
    it('does not change scores when geo+seasonal empty', () => {
      const result = boostInsights([ins('Турция', 0.5)], {
        geo: DEFAULT_SETTINGS.geo,
        seasonal: DEFAULT_SETTINGS.seasonalPriorities,
        bucket: '06-08',
      });
      expect(result[0]?.confidenceScore).toBe(0.5);
    });

    it('adds +0.10 for prioritized country', () => {
      const result = boostInsights([ins('Турция', 0.5)], {
        geo: { prioritized: ['Турция'], blocked: [] },
        seasonal: DEFAULT_SETTINGS.seasonalPriorities,
        bucket: '06-08',
      });
      expect(result[0]?.confidenceScore).toBeCloseTo(0.6, 5);
    });

    it('adds +0.15 for seasonal country in current bucket', () => {
      const result = boostInsights([ins('Турция', 0.5)], {
        geo: DEFAULT_SETTINGS.geo,
        seasonal: { ...DEFAULT_SETTINGS.seasonalPriorities, '06-08': ['Турция'] },
        bucket: '06-08',
      });
      expect(result[0]?.confidenceScore).toBeCloseTo(0.65, 5);
    });

    it('stacks both bonuses but clamps to 1', () => {
      const result = boostInsights([ins('Турция', 0.9)], {
        geo: { prioritized: ['Турция'], blocked: [] },
        seasonal: { ...DEFAULT_SETTINGS.seasonalPriorities, '06-08': ['Турция'] },
        bucket: '06-08',
      });
      expect(result[0]?.confidenceScore).toBeLessThanOrEqual(1);
      expect(result[0]?.confidenceScore).toBe(1);
    });

    it('does not boost countries not in lists', () => {
      const result = boostInsights([ins('Финляндия', 0.5)], {
        geo: { prioritized: ['Турция'], blocked: [] },
        seasonal: { ...DEFAULT_SETTINGS.seasonalPriorities, '06-08': ['Китай'] },
        bucket: '06-08',
      });
      expect(result[0]?.confidenceScore).toBe(0.5);
    });
  });
});
