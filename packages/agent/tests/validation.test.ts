import { describe, it, expect } from 'vitest';
import { SourcesFileSchema, SourceSchema } from '../src/config/sources.schema.js';
import { TourSchema } from '../src/types/tour.js';
import { TravelInsightSchema } from '../src/types/insight.js';

describe('zod schemas', () => {
  describe('SourceSchema', () => {
    it('accepts valid source', () => {
      const result = SourceSchema.safeParse({
        id: 'china-news',
        name: 'China News',
        url: 'https://example.com/news',
        enabled: true,
        language: 'ru',
        type: 'rss',
      });
      expect(result.success).toBe(true);
    });

    it('applies defaults', () => {
      const result = SourceSchema.parse({
        id: 'china',
        name: 'China',
        url: 'https://example.com',
      });
      expect(result.enabled).toBe(true);
      expect(result.language).toBe('ru');
      expect(result.type).toBe('auto');
    });

    it('rejects non-kebab-case id', () => {
      const result = SourceSchema.safeParse({
        id: 'China News',
        name: 'x',
        url: 'https://x.com',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid URL', () => {
      const result = SourceSchema.safeParse({
        id: 'x',
        name: 'x',
        url: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SourcesFileSchema', () => {
    it('accepts the bundled sources.json', async () => {
      const file = await import('../src/config/sources.json', {
        with: { type: 'json' },
      });
      const result = SourcesFileSchema.safeParse(file.default);
      expect(result.success).toBe(true);
    });
  });

  describe('TourSchema', () => {
    it('requires id, title, url', () => {
      const result = TourSchema.safeParse({
        id: '1',
        title: 'Tour',
        url: 'https://x.com',
      });
      expect(result.success).toBe(true);
    });

    it('rejects rating out of range', () => {
      const result = TourSchema.safeParse({
        id: '1',
        title: 't',
        url: 'https://x.com',
        rating: 10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('TravelInsightSchema', () => {
    it('accepts valid insight', () => {
      const result = TravelInsightSchema.safeParse({
        title: 'News',
        sourceUrl: 'https://x.com/n',
        sourceName: 'X',
        shortSummary: 'sum',
        country: 'Китай',
        travelAngle: 'angle',
        confidenceScore: 0.8,
      });
      expect(result.success).toBe(true);
    });

    it('rejects confidenceScore outside [0,1]', () => {
      const result = TravelInsightSchema.safeParse({
        title: 'x',
        sourceUrl: 'https://x.com',
        sourceName: 'x',
        shortSummary: 'x',
        country: 'x',
        travelAngle: 'x',
        confidenceScore: 1.5,
      });
      expect(result.success).toBe(false);
    });
  });
});
