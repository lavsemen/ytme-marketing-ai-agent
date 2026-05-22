import { request } from 'undici';
import { z } from 'zod';
import type { TourClient } from './tourClient.js';
import type { Tour, TourSearchInput } from '../../types/tour.js';
import { SerpItemSchema, SerpResponseSchema, type SerpItem } from './youtravelSchema.js';
import { mapSerpItemToTour } from './youtravelMapper.js';
import { logger } from '../../utils/logger.js';

const INVALID_GEO = new Set(['unknown', 'неизвестно', 'n/a', '']);

export function sanitizeGeoFilter(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || INVALID_GEO.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

export interface YouTravelApiClientOptions {
  baseUrl: string;
  imageBaseUrl: string;
  timeoutMs?: number;
  perPage?: number;
  token?: string;
}

export class YouTravelApiClient implements TourClient {
  private baseUrl: string;
  private imageBaseUrl: string;
  private timeoutMs: number;
  private perPage: number;
  private token?: string;

  constructor(opts: YouTravelApiClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.imageBaseUrl = opts.imageBaseUrl;
    this.timeoutMs = opts.timeoutMs ?? 10000;
    this.perPage = opts.perPage ?? 50;
    if (opts.token) this.token = opts.token;
  }

  async search(input: TourSearchInput): Promise<Tour[]> {
    const limit = input.limit ?? 30;
    const filters = {
      country: sanitizeGeoFilter(input.country),
      city: sanitizeGeoFilter(input.city),
      region: sanitizeGeoFilter(input.region),
    };

    let items = await this.fetchSerp(filters);

    if (items.length === 0 && (filters.country || filters.city || filters.region)) {
      logger.warn(
        { filters },
        'YouTravel: server-side filter returned 0 items, retrying without filters',
      );
      const all = await this.fetchSerp({});
      items = filterClientSide(all, filters);
    }

    const mapped = items.map((item) =>
      mapSerpItemToTour(item, {
        baseUrl: this.baseUrl,
        imageBaseUrl: this.imageBaseUrl,
      }),
    );

    return mapped.slice(0, limit);
  }

  private async fetchSerp(filters: {
    country?: string;
    city?: string;
    region?: string;
  }): Promise<SerpItem[]> {
    const url = this.buildUrl(filters);
    logger.info({ url }, 'YouTravel SERP request');

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'YouTravelMarketingAgent/0.1 (+https://youtravel.me)',
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await this.requestWithRetry(url, headers);
    return parseSerpItems(response);
  }

  private buildUrl(filters: {
    country?: string;
    city?: string;
    region?: string;
  }): string {
    const params = new URLSearchParams();
    params.set('sort_by', 'rank');
    params.set('sort_dir', 'desc');
    params.set('currency', 'rub');
    params.set('lang', 'ru');
    params.set('per_page', String(this.perPage));

    if (filters.country) params.append('countries[]', filters.country);
    if (filters.region) params.append('regions[]', filters.region);
    if (filters.city) params.append('locations[]', filters.city);

    return `${this.baseUrl}/api/v2/serp/tours?${params.toString()}`;
  }

  private async requestWithRetry(
    url: string,
    headers: Record<string, string>,
  ): Promise<unknown> {
    const attempts = 2;
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await request(url, {
          method: 'GET',
          headersTimeout: this.timeoutMs,
          bodyTimeout: this.timeoutMs * 2,
          headers,
        });

        if (res.statusCode >= 500) {
          throw new Error(`YouTravel HTTP ${res.statusCode}`);
        }
        if (res.statusCode >= 400) {
          const body = await res.body.text();
          throw new Error(`YouTravel HTTP ${res.statusCode}: ${body.slice(0, 200)}`);
        }

        return await res.body.json();
      } catch (err) {
        lastErr = err;
        if (i < attempts - 1) {
          const wait = 500 * (i + 1);
          logger.warn({ err, wait }, 'YouTravel request failed, retrying');
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('YouTravel request failed');
  }
}

function parseSerpItems(response: unknown): SerpItem[] {
  const parsed = SerpResponseSchema.safeParse(response);
  if (parsed.success) {
    if (parsed.data.error === true) {
      throw new Error('YouTravelApiClient: API returned error=true');
    }
    return parsed.data.data.items;
  }

  const loose = z
    .object({
      data: z.object({ items: z.array(z.unknown()) }).passthrough(),
    })
    .passthrough()
    .safeParse(response);

  if (!loose.success) {
    logger.error({ issues: parsed.error.issues }, 'YouTravel SERP: invalid response shape');
    throw new Error(
      `YouTravelApiClient: response validation failed: ${parsed.error.message}`,
    );
  }

  const items: SerpItem[] = [];
  let skipped = 0;
  for (const raw of loose.data.data.items) {
    const item = SerpItemSchema.safeParse(raw);
    if (item.success) {
      items.push(item.data);
    } else {
      skipped += 1;
    }
  }

  if (skipped > 0) {
    logger.warn({ skipped, total: loose.data.data.items.length }, 'YouTravel: skipped invalid tour items');
  }
  if (items.length === 0) {
    throw new Error('YouTravelApiClient: no valid tour items in API response');
  }
  return items;
}

function filterClientSide(
  items: SerpItem[],
  input: TourSearchInput,
): SerpItem[] {
  const norm = (s: string | undefined): string => (s ?? '').toLowerCase().trim();
  const country = norm(input.country);
  const region = norm(input.region);
  const city = norm(input.city);

  return items.filter((item) => {
    if (country) {
      const found = (item.countries ?? []).some((c) => norm(c) === country);
      if (!found) return false;
    }
    if (region) {
      const found = (item.regions ?? []).some((r) => norm(r) === region);
      if (!found) return false;
    }
    if (city) {
      const found = (item.locations ?? []).some((l) => norm(l) === city);
      if (!found) return false;
    }
    return true;
  });
}
