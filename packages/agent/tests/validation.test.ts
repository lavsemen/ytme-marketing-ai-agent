import { describe, it, expect } from 'vitest';
import { SourcesFileSchema, SourceSchema } from '../src/config/sources.schema.js';
import { TourSchema } from '../src/types/tour.js';
import { TravelInsightSchema } from '../src/types/insight.js';
import {
  isRejected,
  RejectedPipelineResultSchema,
  ResultMetaSchema,
  type PipelineRunResult,
} from '../src/types/result.js';

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

    it('accepts null optional fields from LLM (coerced to undefined)', () => {
      const result = TravelInsightSchema.safeParse({
        title: 'News',
        sourceUrl: 'https://x.com/n',
        sourceName: 'X',
        shortSummary: 'sum',
        country: 'Конго',
        travelAngle: 'angle',
        seasonality: null,
        targetAudience: null,
        confidenceScore: 0.25,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.seasonality).toBeUndefined();
      }
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

  describe('RejectedPipelineResultSchema', () => {
    it('accepts minimal rejected result and isRejected returns true', () => {
      const parsed = RejectedPipelineResultSchema.safeParse({
        status: 'rejected',
        reason: 'low_confidence',
        message: 'confidence=0.25',
        meta: { createdAt: new Date().toISOString(), agentVersion: '0.1.0' },
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        const run: PipelineRunResult = parsed.data;
        expect(isRejected(run)).toBe(true);
        expect(parsed.data.newsSampled).toEqual([]);
        expect(parsed.data.insights).toEqual([]);
      }
    });

    it('rejects unknown reason', () => {
      const parsed = RejectedPipelineResultSchema.safeParse({
        status: 'rejected',
        reason: 'bad_weather',
        message: 'x',
        meta: { createdAt: new Date().toISOString(), agentVersion: '0.1.0' },
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('ResultMetaSchema', () => {
    it('accepts success meta with landingUrl', () => {
      const parsed = ResultMetaSchema.safeParse({
        slug: 'china-abc',
        createdAt: new Date().toISOString(),
        newsTitle: 'Hello',
        country: 'Китай',
        collectionsCount: 8,
        landingUrl: 'https://example.com/landings/china-abc/',
        status: 'success',
      });
      expect(parsed.success).toBe(true);
    });

    it('accepts rejected meta without landingUrl', () => {
      const parsed = ResultMetaSchema.safeParse({
        slug: 'rejected-12345',
        createdAt: new Date().toISOString(),
        newsTitle: 'Run skipped (low_confidence)',
        collectionsCount: 0,
        status: 'rejected',
        rejectionReason: 'low_confidence',
        rejectionMessage: 'confidence=0.25',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.landingUrl).toBeUndefined();
        expect(parsed.data.rejectionReason).toBe('low_confidence');
      }
    });

    it('defaults status to success for legacy entries', () => {
      const parsed = ResultMetaSchema.safeParse({
        slug: 'legacy',
        createdAt: new Date().toISOString(),
        newsTitle: 'Legacy',
        collectionsCount: 5,
        landingUrl: 'https://example.com/landings/legacy/',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.status).toBe('success');
      }
    });
  });
});
