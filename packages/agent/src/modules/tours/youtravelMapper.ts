import type { Tour } from '../../types/tour.js';
import type { SerpItem } from './youtravelSchema.js';

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

export function decodeHtmlEntities(str: string): string {
  let out = str;
  for (const [from, to] of Object.entries(HTML_ENTITIES)) {
    out = out.split(from).join(to);
  }
  out = out.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  return out;
}

export function stripTags(str: string): string {
  return str.replace(/<[^>]*>/g, ' ');
}

export function cleanDescription(raw: string | undefined, maxLength = 240): string | undefined {
  if (!raw) return undefined;
  const decoded = decodeHtmlEntities(stripTags(raw)).replace(/\s+/g, ' ').trim();
  if (!decoded) return undefined;
  if (decoded.length <= maxLength) return decoded;
  const truncated = decoded.slice(0, maxLength).trimEnd();
  return truncated + '…';
}

export function diffDays(dateFromUnix: number, dateToUnix: number): number {
  const days = Math.round((dateToUnix - dateFromUnix) / 86400);
  return Math.max(1, days);
}

export function formatDuration(fromUnix: number, toUnix: number): string {
  const days = diffDays(fromUnix, toUnix);
  const lastDigit = days % 10;
  const lastTwo = days % 100;
  let suffix = 'дней';
  if (lastTwo < 11 || lastTwo > 14) {
    if (lastDigit === 1) suffix = 'день';
    else if (lastDigit >= 2 && lastDigit <= 4) suffix = 'дня';
  }
  return `${days} ${suffix}`;
}

export function formatPrice(price: number | null | undefined): string | undefined {
  if (price == null || !Number.isFinite(price) || price <= 0) return undefined;
  const formatted = new Intl.NumberFormat('ru-RU').format(Math.round(price));
  return `от ${formatted} ₽`;
}

export function formatDate(unix: number): string {
  const date = new Date(unix * 1000);
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export interface MapperOptions {
  baseUrl: string;
  imageBaseUrl: string;
}

function buildAbsoluteUrl(base: string, path: string): string {
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPath = path.replace(/^\/+/, '');
  return `${trimmedBase}/${trimmedPath}`;
}

export function mapSerpItemToTour(item: SerpItem, opts: MapperOptions): Tour {
  const url = buildAbsoluteUrl(opts.baseUrl, item.link);

  const tour: Tour = {
    id: String(item.id),
    title: item.title.trim(),
    url,
  };

  if (item.preview_image) {
    tour.imageUrl = buildAbsoluteUrl(opts.imageBaseUrl, item.preview_image);
  }

  const desc = cleanDescription(item.description ?? undefined);
  if (desc) tour.shortDescription = desc;

  const minPriceDate = item.dates?.group_min_price ?? item.dates?.slice?.[0];
  if (minPriceDate) {
    const price = formatPrice(minPriceDate.price ?? minPriceDate.actual_price ?? undefined);
    if (price) tour.price = price;

    if (minPriceDate.date_from && minPriceDate.date_to) {
      tour.duration = formatDuration(minPriceDate.date_from, minPriceDate.date_to);
    }
  }

  if (item.expert?.rating != null) {
    tour.rating = Math.round(item.expert.rating * 10) / 10;
  }
  if (item.expert?.count_reviews != null) {
    tour.reviewsCount = item.expert.count_reviews;
  }

  const slice = item.dates?.slice ?? [];
  const dateLabels = slice
    .map((d) => d.date_from)
    .filter((d): d is number => d != null && Number.isFinite(d))
    .slice(0, 5)
    .map((d) => formatDate(d));
  if (dateLabels.length > 0) {
    tour.dates = dateLabels;
  }

  if (item.countries && item.countries.length > 0 && item.countries[0]) {
    tour.country = item.countries[0];
  }
  if (item.regions && item.regions.length > 0 && item.regions[0]) {
    tour.region = item.regions[0];
  }
  if (item.locations && item.locations.length > 0 && item.locations[0]) {
    tour.city = item.locations[0];
  }
  if (item.types && item.types.length > 0) {
    tour.tags = item.types.map((t) => t.title).filter(Boolean);
  }

  return tour;
}
