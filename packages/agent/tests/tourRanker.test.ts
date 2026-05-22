import { describe, it, expect } from 'vitest';
import { rankTours } from '../src/modules/tours/tourRanker.js';
import type { Tour } from '../src/types/tour.js';
import type { TravelInsight } from '../src/types/insight.js';

const insight: TravelInsight = {
  title: 'Безвиз с Китаем',
  sourceUrl: 'https://example.com/news/1',
  sourceName: 'Example',
  shortSummary: 'Китай продлил безвиз',
  country: 'Китай',
  travelAngle: 'Доступное направление для авторских туров',
  confidenceScore: 0.9,
};

function makeTour(partial: Partial<Tour> & Pick<Tour, 'id' | 'title' | 'url'>): Tour {
  return {
    rating: 4.5,
    imageUrl: 'https://example.com/img.jpg',
    dates: ['10 окт 2026'],
    price: 'от 100 000 ₽',
    tags: ['Экскурсионный'],
    reviewsCount: 100,
    ...partial,
  } as Tour;
}

describe('rankTours', () => {
  it('prefers tours matching the insight country', () => {
    const tours: Tour[] = [
      makeTour({ id: '1', title: 'Турция', url: 'https://x/1', country: 'Турция' }),
      makeTour({ id: '2', title: 'Китай Авторский', url: 'https://x/2', country: 'Китай' }),
      makeTour({ id: '3', title: 'Италия', url: 'https://x/3', country: 'Италия' }),
    ];
    const result = rankTours(tours, insight, { minCount: 1, maxCount: 5 });
    expect(result[0]?.country).toBe('Китай');
  });

  it('respects maxCount', () => {
    const tours: Tour[] = Array.from({ length: 12 }, (_, i) =>
      makeTour({
        id: String(i),
        title: `Тур ${i}`,
        url: `https://x/${i}`,
        country: 'Китай',
        tags: [`Тип-${i % 3}`],
      }),
    );
    const result = rankTours(tours, insight, { minCount: 3, maxCount: 6 });
    expect(result.length).toBeLessThanOrEqual(6);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('returns empty array when no tours', () => {
    expect(rankTours([], insight)).toEqual([]);
  });

  it('falls back to top-N if diversity filter shrinks list below minCount', () => {
    const tours: Tour[] = Array.from({ length: 4 }, (_, i) =>
      makeTour({
        id: String(i),
        title: `Тур ${i}`,
        url: `https://x/${i}`,
        country: 'Китай',
        tags: ['Экскурсионный'],
      }),
    );
    const result = rankTours(tours, insight, { minCount: 3, maxCount: 8 });
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('ranks tours with images and ratings higher', () => {
    const tours: Tour[] = [
      makeTour({
        id: 'a',
        title: 'Без картинки',
        url: 'https://x/a',
        country: 'Китай',
        rating: 4.0,
      }),
      makeTour({
        id: 'b',
        title: 'С картинкой высокий рейтинг',
        url: 'https://x/b',
        country: 'Китай',
        rating: 4.9,
        imageUrl: 'https://example.com/b.jpg',
      }),
    ];
    delete (tours[0] as Tour).imageUrl;
    const result = rankTours(tours, insight, { minCount: 1, maxCount: 2 });
    expect(result[0]?.id).toBe('b');
  });
});
