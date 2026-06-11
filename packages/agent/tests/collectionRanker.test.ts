import { describe, it, expect } from 'vitest';
import { rankCollections } from '../src/modules/catalog/collectionRanker.js';
import type { CatalogPage } from '../src/types/catalogPage.js';
import type { TravelInsight } from '../src/types/insight.js';

function page(overrides: Partial<CatalogPage> & Pick<CatalogPage, 'url' | 'title'>): CatalogPage {
  return {
    pageClass: 'континенты',
    pageType: 'континенты',
    purpose: 'Целевая страница каталога',
    ...overrides,
  };
}

function insight(overrides: Partial<TravelInsight> = {}): TravelInsight {
  return {
    title: 'Китай продлил безвиз',
    sourceUrl: 'https://example.com/news',
    sourceName: 'Example',
    shortSummary: 'Китай продлил безвиз для россиян.',
    country: 'Китай',
    travelAngle: 'Безвиз снижает барьер для поездок',
    confidenceScore: 0.9,
    ...overrides,
  };
}

describe('collectionRanker', () => {
  const catalog: CatalogPage[] = [
    page({
      url: 'https://youtravel.me/tours/continent/китай',
      title: 'Туры в Китай',
      purpose: 'Целевая страница каталога',
      tourCount: 120,
    }),
    page({
      url: 'https://youtravel.me/tours/continent/китай/month-oct',
      title: 'Туры в Китай в октябре',
      pageType: 'SEO-фильтр',
      purpose: 'Месяцы - октябрь',
    }),
    page({
      url: 'https://youtravel.me/tours/continent/европа',
      title: 'Туры в Европу',
      purpose: 'Целевая страница каталога',
      tourCount: 80,
    }),
  ];

  it('matches country-specific catalog page as primary', () => {
    const result = rankCollections(catalog, insight(), { minScore: 12 });
    expect(result.primary?.url).toBe('https://youtravel.me/tours/continent/китай');
    expect(result.related.length).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThanOrEqual(12);
  });

  it('prefers catalog target page over SEO filter at similar geo score', () => {
    const result = rankCollections(catalog, insight(), { minScore: 1 });
    expect(result.primary?.purpose).toBe('Целевая страница каталога');
  });

  it('returns no primary when nothing matches threshold', () => {
    const result = rankCollections(catalog, insight({ country: 'Антарктида' }), { minScore: 50 });
    expect(result.primary).toBeNull();
  });
});
