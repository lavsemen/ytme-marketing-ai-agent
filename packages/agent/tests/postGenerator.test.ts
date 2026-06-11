import { describe, it, expect } from 'vitest';
import { enrichMarketingTextWithCollections } from '../src/modules/ai/postGenerator.js';
import type { MatchedCollections } from '../src/types/catalogPage.js';

function matched(overrides: Partial<MatchedCollections> = {}): MatchedCollections {
  const primary = {
    url: 'https://youtravel.me/tours/continent/китай',
    title: 'Туры в Китай',
    pageClass: 'континенты',
    pageType: 'континенты',
    purpose: 'Целевая страница каталога',
    tourCount: 120,
  };
  const related = {
    url: 'https://youtravel.me/tours/continent/китай/month-oct',
    title: 'Туры в Китай в октябре',
    pageClass: 'континенты',
    pageType: 'SEO-фильтр',
    purpose: 'Месяцы - октябрь',
  };
  return {
    primary,
    related: [primary, related],
    ...overrides,
  };
}

describe('enrichMarketingTextWithCollections', () => {
  it('appends primary and related when URLs are missing', () => {
    const text = 'Китай открыл безвиз — отличный повод спланировать поездку.';
    const result = enrichMarketingTextWithCollections(text, matched());
    expect(result).toContain('Подборки YouTravel.me:');
    expect(result).toContain('https://youtravel.me/tours/continent/китай');
    expect(result).toContain('«Туры в Китай в октябре»');
    expect(result).toContain('120 туров');
  });

  it('does not duplicate when primary URL is already in text', () => {
    const url = 'https://youtravel.me/tours/continent/китай';
    const text = `Смотрите подборку: ${url}`;
    const result = enrichMarketingTextWithCollections(text, matched());
    expect(result).not.toContain('«Туры в Китай»');
    expect(result).toContain('«Туры в Китай в октябре»');
  });

  it('returns text unchanged when all collections are already mentioned', () => {
    const m = matched();
    const text = [
      'Новость про Китай.',
      m.primary.url,
      m.related[1]!.title,
      m.related[1]!.url,
    ].join('\n');
    expect(enrichMarketingTextWithCollections(text, m)).toBe(text.trim());
  });
});
