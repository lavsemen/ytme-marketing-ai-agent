import { describe, it, expect } from 'vitest';
import fixture from './fixtures/youtravel-serp-sample.json' with { type: 'json' };
import { SerpResponseSchema } from '../src/modules/tours/youtravelSchema.js';
import {
  cleanDescription,
  decodeHtmlEntities,
  diffDays,
  formatDuration,
  formatPrice,
  mapSerpItemToTour,
  stripTags,
} from '../src/modules/tours/youtravelMapper.js';

const MAPPER_OPTS = {
  baseUrl: 'https://youtravel.me',
  imageBaseUrl: 'https://youtravel.me/',
};

describe('YouTravel mapper helpers', () => {
  it('decodes HTML entities', () => {
    expect(decodeHtmlEntities('A&nbsp;&amp;&nbsp;B')).toBe('A & B');
    expect(decodeHtmlEntities('&#1050;')).toBe('К');
  });

  it('strips tags', () => {
    expect(stripTags('<p>Hello <b>World</b></p>')).toContain('Hello');
    expect(stripTags('<p>Hello <b>World</b></p>')).not.toContain('<');
  });

  it('cleans descriptions', () => {
    expect(cleanDescription('  Hello   &nbsp; world')).toBe('Hello world');
    const long = 'a'.repeat(500);
    const result = cleanDescription(long, 100);
    expect(result?.length).toBeLessThanOrEqual(101);
    expect(result?.endsWith('…')).toBe(true);
  });

  it('diffDays computes correctly', () => {
    expect(diffDays(0, 86400)).toBe(1);
    expect(diffDays(0, 86400 * 7)).toBe(7);
  });

  it('formatDuration uses Russian plurals', () => {
    expect(formatDuration(0, 86400)).toBe('1 день');
    expect(formatDuration(0, 86400 * 2)).toBe('2 дня');
    expect(formatDuration(0, 86400 * 5)).toBe('5 дней');
    expect(formatDuration(0, 86400 * 11)).toBe('11 дней');
    expect(formatDuration(0, 86400 * 22)).toBe('22 дня');
  });

  it('formatPrice formats RUB', () => {
    expect(formatPrice(145000)).toMatch(/145\s?000/);
    expect(formatPrice(0)).toBeUndefined();
    expect(formatPrice(null)).toBeUndefined();
  });
});

describe('YouTravel fixture parsing & mapping', () => {
  it('parses real-shape SERP response with zod', () => {
    const parsed = SerpResponseSchema.safeParse(fixture);
    expect(parsed.success).toBe(true);
  });

  it('maps SERP items to Tour shape', () => {
    const parsed = SerpResponseSchema.parse(fixture);
    const tours = parsed.data.items.map((item) => mapSerpItemToTour(item, MAPPER_OPTS));

    expect(tours).toHaveLength(3);

    const maldives = tours[0]!;
    expect(maldives.id).toBe('46766');
    expect(maldives.country).toBe('Мальдивы');
    expect(maldives.url).toBe('https://youtravel.me/tours/46766/uletnye_maldivy_po_4_ostrovam');
    expect(maldives.imageUrl).toBe(
      'https://youtravel.me/public/images/tour/media/2025/12/17/4023f6b1f26c2d4a27a04f38cb027f317b6eb12d.jpg',
    );
    expect(maldives.price).toMatch(/145\s?000\s?₽/);
    expect(maldives.duration).toBe('7 дней');
    expect(maldives.rating).toBe(5);
    expect(maldives.reviewsCount).toBe(372);
    expect(maldives.dates).toBeDefined();
    expect(maldives.dates!.length).toBe(2);
    expect(maldives.tags).toContain('Экскурсионный');
    expect(maldives.shortDescription).not.toContain('&nbsp;');

    const russia = tours[1]!;
    expect(russia.country).toBe('Россия');
    expect(russia.region).toBe('Мурманск');

    const altai = tours[2]!;
    expect(altai.price).toBeUndefined();
    expect(altai.dates).toBeUndefined();
  });
});
