import { describe, it, expect } from 'vitest';
import {
  infopovodKeyForInsight,
  normalizeInfopovodTitle,
} from '../src/modules/infopovod/infopovodKey.js';
import type { TravelInsight } from '../src/types/insight.js';
import type { NewsItem } from '../src/types/news.js';

function insight(overrides: Partial<TravelInsight> = {}): TravelInsight {
  return {
    title: 'Китай продлил безвиз',
    sourceUrl: 'https://example.com/news/china',
    sourceName: 'Example',
    shortSummary: 'Кратко.',
    country: 'Китай',
    travelAngle: 'Безвиз',
    confidenceScore: 0.9,
    ...overrides,
  };
}

function newsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    title: 'Китай продлил безвиз для россиян до 2027',
    url: 'https://example.com/news/china',
    sourceName: 'Example',
    sourceId: 'example',
    summary: 'Summary',
    ...overrides,
  };
}

describe('normalizeInfopovodTitle', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeInfopovodTitle('Китай без визы.')).toBe('китай без визы');
    expect(normalizeInfopovodTitle('«Китай без визы»')).toBe('китай без визы');
  });

  it('collapses whitespace', () => {
    expect(normalizeInfopovodTitle('Китай   без   визы')).toBe('китай без визы');
  });

  it('maps similar titles to the same key', () => {
    const a = normalizeInfopovodTitle('Китай без визы!');
    const b = normalizeInfopovodTitle('китай без визы');
    expect(a).toBe(b);
  });
});

describe('infopovodKeyForInsight', () => {
  it('prefers news title matched by sourceUrl', () => {
    const key = infopovodKeyForInsight(
      insight({ title: 'LLM paraphrase' }),
      [newsItem({ title: 'Original RSS headline' })],
    );
    expect(key).toBe(normalizeInfopovodTitle('Original RSS headline'));
  });

  it('falls back to insight title when news not found', () => {
    const key = infopovodKeyForInsight(insight(), []);
    expect(key).toBe(normalizeInfopovodTitle('Китай продлил безвиз'));
  });
});
