import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  applyTemplate,
  buildContextBlock,
  buildEffectivePrompts,
  currentMonthBucket,
  mergePrompts,
  mergeSettings,
} from '../src/config/agentConfig.js';
import { DEFAULT_PROMPTS } from '../src/modules/ai/prompts.js';

describe('agentConfig', () => {
  describe('mergeSettings', () => {
    it('returns defaults when override is empty', () => {
      const merged = mergeSettings({});
      expect(merged.pipeline.confidenceThreshold).toBe(DEFAULT_SETTINGS.pipeline.confidenceThreshold);
      expect(merged.brand.voice).toBe('friendly');
    });

    it('overrides only specified leaf values', () => {
      const merged = mergeSettings({
        brand: { voice: 'luxury', bannedWords: ['дёшево'] },
        pipeline: { confidenceThreshold: 0.6 },
      });
      expect(merged.brand.voice).toBe('luxury');
      expect(merged.brand.bannedWords).toEqual(['дёшево']);
      expect(merged.brand.name).toBe('YouTravel.me');
      expect(merged.pipeline.confidenceThreshold).toBe(0.6);
      expect(merged.pipeline.minTours).toBe(3);
    });

    it('throws on invalid values', () => {
      expect(() => mergeSettings({ pipeline: { confidenceThreshold: 5 } })).toThrow();
      expect(() => mergeSettings({ brand: { voice: 'aggressive' } })).toThrow();
    });

    it('arrays are replaced wholesale (not merged)', () => {
      const merged = mergeSettings({ geo: { blocked: ['КНДР'] } });
      expect(merged.geo.blocked).toEqual(['КНДР']);
      expect(merged.geo.prioritized).toEqual([]);
    });

    it('accepts null in tour filters', () => {
      const merged = mergeSettings({ tourFilters: { minPriceRub: 30000, maxPriceRub: null } });
      expect(merged.tourFilters.minPriceRub).toBe(30000);
      expect(merged.tourFilters.maxPriceRub).toBeNull();
    });
  });

  describe('mergePrompts', () => {
    it('returns defaults when no override', () => {
      const merged = mergePrompts(DEFAULT_PROMPTS, {});
      expect(merged.newsAnalyzer).toBe(DEFAULT_PROMPTS.newsAnalyzer);
    });

    it('overrides a single prompt', () => {
      const merged = mergePrompts(DEFAULT_PROMPTS, {
        postGenerator: 'custom post prompt',
      });
      expect(merged.postGenerator).toBe('custom post prompt');
      expect(merged.factCheck).toBe(DEFAULT_PROMPTS.factCheck);
    });

    it('rejects empty string', () => {
      expect(() => mergePrompts(DEFAULT_PROMPTS, { postGenerator: '' })).toThrow();
    });
  });

  describe('applyTemplate', () => {
    it('replaces simple placeholder', () => {
      expect(applyTemplate('Hello {{name}}', { name: 'world' })).toBe('Hello world');
    });

    it('replaces nested path', () => {
      expect(applyTemplate('{{brand.voice}}', { brand: { voice: 'friendly' } })).toBe('friendly');
    });

    it('joins arrays with comma', () => {
      expect(applyTemplate('{{list}}', { list: ['a', 'b'] })).toBe('a, b');
    });

    it('renders empty for missing keys', () => {
      expect(applyTemplate('X={{missing}}Y', {})).toBe('X=Y');
    });
  });

  describe('buildContextBlock', () => {
    it('includes brand voice and audience always', () => {
      const block = buildContextBlock({ settings: DEFAULT_SETTINGS });
      expect(block).toContain('Бренд: YouTravel.me');
      expect(block).toContain('Голос:');
      expect(block).toContain('Целевая аудитория');
    });

    it('omits empty geo/season/banned lines', () => {
      const block = buildContextBlock({ settings: DEFAULT_SETTINGS });
      expect(block).not.toContain('Запрещённые слова');
      expect(block).not.toContain('ЗАПРЕЩЁННЫЕ страны');
      expect(block).not.toContain('Сезонный приоритет');
    });

    it('renders hint when provided', () => {
      const block = buildContextBlock({
        settings: DEFAULT_SETTINGS,
        hint: '  focus on family travel  ',
      });
      expect(block).toContain('Дополнительные инструкции маркетолога');
      expect(block).toContain('focus on family travel');
    });

    it('renders blocked countries when set', () => {
      const block = buildContextBlock({
        settings: mergeSettings({ geo: { blocked: ['КНДР', 'Сирия'] } }),
      });
      expect(block).toContain('ЗАПРЕЩЁННЫЕ страны');
      expect(block).toContain('КНДР');
    });

    it('renders seasonal priorities for current bucket', () => {
      const bucket = currentMonthBucket();
      const block = buildContextBlock({
        settings: mergeSettings({
          seasonalPriorities: { [bucket]: ['ТестоваяСтрана'] } as Record<string, string[]>,
        }),
      });
      expect(block).toContain('Сезонный приоритет');
      expect(block).toContain('ТестоваяСтрана');
    });
  });

  describe('buildEffectivePrompts', () => {
    it('appends context to every prompt', () => {
      const eff = buildEffectivePrompts(DEFAULT_PROMPTS, {
        settings: DEFAULT_SETTINGS,
        hint: 'test-hint',
      });
      for (const key of ['newsAnalyzer', 'postGenerator', 'landingContent', 'factCheck'] as const) {
        expect(eff[key]).toContain('test-hint');
        expect(eff[key].startsWith(DEFAULT_PROMPTS[key])).toBe(true);
      }
    });
  });

  describe('currentMonthBucket', () => {
    it('maps Dec/Jan/Feb to 12-02', () => {
      expect(currentMonthBucket(new Date('2026-01-15'))).toBe('12-02');
      expect(currentMonthBucket(new Date('2026-12-15'))).toBe('12-02');
    });
    it('maps Mar-May to 03-05', () => {
      expect(currentMonthBucket(new Date('2026-04-10'))).toBe('03-05');
    });
    it('maps Jun-Aug to 06-08', () => {
      expect(currentMonthBucket(new Date('2026-07-10'))).toBe('06-08');
    });
    it('maps Sep-Nov to 09-11', () => {
      expect(currentMonthBucket(new Date('2026-10-10'))).toBe('09-11');
    });
  });
});
