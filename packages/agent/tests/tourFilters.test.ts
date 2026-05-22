import { describe, it, expect } from 'vitest';
import { applyTourFilters, parseNights, parsePriceRub } from '../src/modules/tours/tourFilters.js';
import type { Tour } from '../src/types/tour.js';

function tour(overrides: Partial<Tour> = {}): Tour {
  return {
    id: overrides.id ?? '1',
    title: overrides.title ?? 'T',
    url: overrides.url ?? 'https://example.com/1',
    ...overrides,
  };
}

describe('tourFilters', () => {
  describe('parsePriceRub', () => {
    it('parses "от 65 000 ₽"', () => {
      expect(parsePriceRub('от 65 000 ₽')).toBe(65000);
    });
    it('parses plain digits', () => {
      expect(parsePriceRub('120000')).toBe(120000);
    });
    it('returns null for EUR/USD', () => {
      expect(parsePriceRub('1 200 €')).toBeNull();
      expect(parsePriceRub('1500 USD')).toBeNull();
    });
    it('returns null for undefined/empty', () => {
      expect(parsePriceRub(undefined)).toBeNull();
      expect(parsePriceRub('')).toBeNull();
    });
  });

  describe('parseNights', () => {
    it('parses "7 ночей"', () => {
      expect(parseNights('7 ночей')).toBe(7);
    });
    it('parses "10 дней / 9 ночей" prefers nights', () => {
      expect(parseNights('10 дней / 9 ночей')).toBe(9);
    });
    it('falls back to days - 1', () => {
      expect(parseNights('7 дней')).toBe(6);
    });
    it('returns null when no match', () => {
      expect(parseNights('weekend')).toBeNull();
    });
  });

  describe('applyTourFilters', () => {
    it('keeps everything when filters are null', () => {
      const tours = [tour({ price: 'от 30 000 ₽' }), tour({ id: '2', price: 'от 200 000 ₽' })];
      const r = applyTourFilters(tours, { minPriceRub: null, maxPriceRub: null, minNights: null, maxNights: null });
      expect(r.kept.length).toBe(2);
      expect(r.removed.length).toBe(0);
    });

    it('drops by minPriceRub', () => {
      const tours = [tour({ price: 'от 20 000 ₽' }), tour({ id: '2', price: 'от 80 000 ₽' })];
      const r = applyTourFilters(tours, { minPriceRub: 50000, maxPriceRub: null, minNights: null, maxNights: null });
      expect(r.kept.map((t) => t.id)).toEqual(['2']);
      expect(r.removed.length).toBe(1);
    });

    it('drops by maxPriceRub', () => {
      const tours = [tour({ price: 'от 600 000 ₽' }), tour({ id: '2', price: 'от 80 000 ₽' })];
      const r = applyTourFilters(tours, { minPriceRub: null, maxPriceRub: 500000, minNights: null, maxNights: null });
      expect(r.kept.map((t) => t.id)).toEqual(['2']);
    });

    it('soft-filters unparseable price (keeps tour)', () => {
      const tours = [tour({ price: '1 500 €' })];
      const r = applyTourFilters(tours, { minPriceRub: 50000, maxPriceRub: 200000, minNights: null, maxNights: null });
      expect(r.kept.length).toBe(1);
    });

    it('drops by nights range', () => {
      const tours = [
        tour({ duration: '3 ночи' }),
        tour({ id: '2', duration: '7 ночей' }),
        tour({ id: '3', duration: '21 ночь' }),
      ];
      const r = applyTourFilters(tours, { minPriceRub: null, maxPriceRub: null, minNights: 5, maxNights: 15 });
      expect(r.kept.map((t) => t.id)).toEqual(['2']);
    });
  });
});
