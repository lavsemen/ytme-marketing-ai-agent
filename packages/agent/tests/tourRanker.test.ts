import { describe, it, expect } from 'vitest';
import { rankTours, rankToursDetailed } from '../src/modules/tours/tourRanker.js';
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

describe('rankTours › topic relevance', () => {
  it('REGRESSION: topic-matching tour beats slightly-higher-rated generic tour at equal country', () => {
    // Same country, same rating, but only one matches the news topic.
    const topicInsight: TravelInsight = {
      title: 'Открыт термальный курорт в Памуккале',
      sourceUrl: 'https://example.com/news/2',
      sourceName: 'Example',
      shortSummary: 'В Памуккале запустили новый термальный комплекс с источниками.',
      country: 'Турция',
      travelAngle: 'термальные источники и спа',
      confidenceScore: 0.9,
    };

    const tours: Tour[] = [
      {
        id: 'spa',
        title: 'Памуккале и термальные источники',
        url: 'https://x/spa',
        country: 'Турция',
        tags: ['Термальные источники', 'Спа'],
        shortDescription: 'Термальный отдых в Памуккале',
        rating: 4.5,
        imageUrl: 'https://x/spa.jpg',
        price: 'от 80 000 ₽',
        dates: ['10 окт'],
        reviewsCount: 60,
      },
      {
        id: 'beach',
        title: 'Пляжный отдых в Анталье',
        url: 'https://x/beach',
        country: 'Турция',
        tags: ['Пляжный', 'All inclusive'],
        shortDescription: 'Отдых на пляже',
        rating: 4.9,
        imageUrl: 'https://x/beach.jpg',
        price: 'от 70 000 ₽',
        dates: ['10 окт'],
        reviewsCount: 200,
      },
    ];

    const result = rankToursDetailed(tours, topicInsight, { minCount: 1, maxCount: 2 });
    expect(result.tours[0]?.id).toBe('spa');
    // Sanity: spa should have non-zero topic score; beach should have zero
    const spaDebug = result.debug.find((d) => d.id === 'spa');
    const beachDebug = result.debug.find((d) => d.id === 'beach');
    expect(spaDebug?.topic).toBeGreaterThan(0);
    expect(beachDebug?.topic).toBe(0);
  });

  it('boosts tour whose location matches a city detected in news summary', () => {
    // insight.city is empty, but summary mentions Каппадокия explicitly.
    const cappadociaInsight: TravelInsight = {
      title: 'В Каппадокии новый сезон полётов на воздушных шарах',
      sourceUrl: 'https://example.com/news/3',
      sourceName: 'Example',
      shortSummary: 'В Каппадокии открылся новый сезон полётов на воздушных шарах.',
      country: 'Турция',
      travelAngle: 'воздушные шары',
      confidenceScore: 0.8,
    };

    const tours: Tour[] = [
      {
        id: 'cappadocia',
        title: 'Каппадокия: полёт на шарах',
        url: 'https://x/cap',
        country: 'Турция',
        city: 'Каппадокия',
        tags: ['Активный'],
        rating: 4.3,
        imageUrl: 'https://x/cap.jpg',
        price: 'от 90 000 ₽',
        dates: ['1 ноя'],
      },
      {
        id: 'istanbul',
        title: 'Стамбул выходного дня',
        url: 'https://x/ist',
        country: 'Турция',
        city: 'Стамбул',
        tags: ['Экскурсионный'],
        rating: 4.8,
        imageUrl: 'https://x/ist.jpg',
        price: 'от 60 000 ₽',
        dates: ['1 ноя'],
        reviewsCount: 500,
      },
    ];

    const result = rankToursDetailed(tours, cappadociaInsight, { minCount: 1, maxCount: 2 });
    expect(result.keywords.detectedLocations).toContain('каппадокия');
    expect(result.tours[0]?.id).toBe('cappadocia');
    const debug = result.debug.find((d) => d.id === 'cappadocia');
    expect(debug?.locationBoost).toBeGreaterThan(0);
  });

  it('keyword in shortDescription contributes to topic score (1 point per primary hit)', () => {
    const gastroInsight: TravelInsight = {
      title: 'Гастрономический фестиваль в Тоскане',
      sourceUrl: 'https://example.com/news/4',
      sourceName: 'Example',
      shortSummary: 'В Тоскане проходит большой винный фестиваль.',
      country: 'Италия',
      travelAngle: 'гастрономия и вино',
      confidenceScore: 0.85,
    };

    const tours: Tour[] = [
      {
        id: 'desc-match',
        title: 'Тур по Италии',
        url: 'https://x/d',
        country: 'Италия',
        tags: ['Авторский'],
        shortDescription: 'Гастрономические дегустации и винные подвалы Тосканы.',
        rating: 4.0,
      },
      {
        id: 'no-match',
        title: 'Тур по Италии',
        url: 'https://x/n',
        country: 'Италия',
        tags: ['Авторский'],
        shortDescription: 'Обзорная экскурсия по основным достопримечательностям.',
        rating: 4.0,
      },
    ];

    const result = rankToursDetailed(tours, gastroInsight, { minCount: 1, maxCount: 2 });
    expect(result.tours[0]?.id).toBe('desc-match');
    const match = result.debug.find((d) => d.id === 'desc-match');
    const noMatch = result.debug.find((d) => d.id === 'no-match');
    expect((match?.topic ?? 0)).toBeGreaterThan(noMatch?.topic ?? 0);
  });

  it('rankToursDetailed exposes keywords and top-5 debug', () => {
    const tours: Tour[] = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      title: `Тур ${i}`,
      url: `https://x/${i}`,
      country: 'Китай',
      tags: ['Экскурсионный'],
      rating: 4 + (i % 5) * 0.1,
    }));
    const result = rankToursDetailed(tours, insight, { minCount: 3, maxCount: 6 });
    expect(result.debug.length).toBeLessThanOrEqual(5);
    expect(result.keywords.primary.length).toBeGreaterThan(0);
    for (const d of result.debug) {
      // total is the rounded sum of rounded parts — allow small rounding drift.
      expect(d.total).toBeCloseTo(d.geo + d.quality + d.topic + d.locationBoost, 0);
    }
  });
});
