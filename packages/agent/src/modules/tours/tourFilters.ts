import type { Tour } from '../../types/tour.js';
import type { TourFiltersSettings } from '../../config/agentConfig.js';

/** Parse price string (e.g. "от 65 000 ₽", "65000 RUB", "от 1 200 €") into RUB number, or null. */
export function parsePriceRub(priceStr: string | undefined): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/\u00a0/g, ' ');
  // We only handle prices that look like rubles; non-RUB returns null (soft filter)
  if (/[€$£]|EUR|USD|GBP/i.test(cleaned)) return null;
  const digits = cleaned.match(/(\d[\d\s]*)/);
  if (!digits) return null;
  const n = Number(digits[1]!.replace(/\s/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Extract nights count from duration string ("7 ночей", "10 дней / 9 ночей"), or null. */
export function parseNights(durationStr: string | undefined): number | null {
  if (!durationStr) return null;
  const nightsMatch = durationStr.match(/(\d+)\s*ноч/i);
  if (nightsMatch?.[1]) return Number(nightsMatch[1]);
  const daysMatch = durationStr.match(/(\d+)\s*дн/i);
  if (daysMatch?.[1]) {
    const d = Number(daysMatch[1]);
    return d > 1 ? d - 1 : d; // approximate
  }
  return null;
}

export interface TourFilterResult {
  kept: Tour[];
  removed: { tour: Tour; reason: string }[];
}

/** Soft filter: if a tour's price/nights can't be parsed, it stays in. */
export function applyTourFilters(tours: Tour[], filters: TourFiltersSettings): TourFilterResult {
  const kept: Tour[] = [];
  const removed: { tour: Tour; reason: string }[] = [];

  for (const tour of tours) {
    const price = parsePriceRub(tour.price);
    const nights = parseNights(tour.duration);

    if (filters.minPriceRub !== null && price !== null && price < filters.minPriceRub) {
      removed.push({ tour, reason: `price ${price} < ${filters.minPriceRub}` });
      continue;
    }
    if (filters.maxPriceRub !== null && price !== null && price > filters.maxPriceRub) {
      removed.push({ tour, reason: `price ${price} > ${filters.maxPriceRub}` });
      continue;
    }
    if (filters.minNights !== null && nights !== null && nights < filters.minNights) {
      removed.push({ tour, reason: `nights ${nights} < ${filters.minNights}` });
      continue;
    }
    if (filters.maxNights !== null && nights !== null && nights > filters.maxNights) {
      removed.push({ tour, reason: `nights ${nights} > ${filters.maxNights}` });
      continue;
    }
    kept.push(tour);
  }

  return { kept, removed };
}
