import { describe, it, expect } from 'vitest';
import { pickFreshInsight } from '../src/modules/infopovod/usedInfopovods.js';
import { normalizeInfopovodTitle } from '../src/modules/infopovod/infopovodKey.js';
import type { TravelInsight } from '../src/types/insight.js';
import type { NewsItem } from '../src/types/news.js';

function mkInsight(
  url: string,
  title: string,
  score: number,
): TravelInsight {
  return {
    title,
    sourceUrl: url,
    sourceName: 'Example',
    shortSummary: 'Summary',
    country: 'Китай',
    travelAngle: 'Travel',
    confidenceScore: score,
  };
}

function mkNews(url: string, title: string): NewsItem {
  return {
    title,
    url,
    sourceName: 'Example',
    sourceId: 'example',
    summary: 'Summary',
  };
}

describe('pickFreshInsight', () => {
  const news = [
    mkNews('https://example.com/a', 'Китай без визы'),
    mkNews('https://example.com/b', 'Турция открыла сезон'),
  ];
  const insights = [
    mkInsight('https://example.com/a', 'Китай без визы', 0.95),
    mkInsight('https://example.com/b', 'Турция открыла сезон', 0.8),
  ];

  it('picks highest-confidence insight when none are used', () => {
    const picked = pickFreshInsight(insights, news, new Set());
    expect(picked?.sourceUrl).toBe('https://example.com/a');
  });

  it('skips used insight and picks next by score', () => {
    const used = new Set([normalizeInfopovodTitle('Китай без визы')]);
    const picked = pickFreshInsight(insights, news, used);
    expect(picked?.sourceUrl).toBe('https://example.com/b');
  });

  it('returns null when all insights are used', () => {
    const used = new Set([
      normalizeInfopovodTitle('Китай без визы'),
      normalizeInfopovodTitle('Турция открыла сезон'),
    ]);
    expect(pickFreshInsight(insights, news, used)).toBeNull();
  });
});
