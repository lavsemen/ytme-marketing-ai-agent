import { CONFIG } from '../lib/config';
import { createGithubClient, getFileContent } from './github';

export interface ResultMeta {
  slug: string;
  createdAt: string;
  newsTitle: string;
  country?: string;
  toursCount: number;
  landingUrl: string;
}

export interface PipelineResultJson {
  news: { title: string; sourceName: string; sourceUrl: string; summary: string };
  insight: {
    title: string;
    country: string;
    region?: string;
    city?: string;
    travelAngle: string;
    seasonality?: string;
    targetAudience?: string;
    confidenceScore: number;
    shortSummary: string;
    sourceUrl: string;
    sourceName: string;
  };
  tours: {
    id: string;
    title: string;
    url: string;
    imageUrl?: string;
    shortDescription?: string;
    price?: string;
    rating?: number;
    duration?: string;
    dates?: string[];
  }[];
  post: {
    marketingTitle: string;
    marketingText: string;
    landingUrl: string;
    imageUrl?: string;
  };
  landing: { slug: string; path: string; url: string };
  meta: { createdAt: string; agentVersion: string; runId?: string };
}

/** Public landing URL from slug (ignores stale landingUrl saved in index.json). */
export function publicLandingUrl(slug: string, fallback?: string): string {
  if (CONFIG.landingBaseUrl) {
    return `${CONFIG.landingBaseUrl}/landings/${encodeURIComponent(slug)}/`;
  }
  return fallback ?? '';
}

function normalizeMeta(entry: ResultMeta): ResultMeta {
  return {
    ...entry,
    landingUrl: publicLandingUrl(entry.slug, entry.landingUrl),
  };
}

function cacheBust(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${Date.now()}`;
}

/** GitHub Contents API — always matches branch main in the repo (not stale Pages). */
export async function fetchResultsIndexFromRepo(token: string): Promise<ResultMeta[]> {
  const client = createGithubClient(token);
  const file = await getFileContent(client, CONFIG.resultsIndexPath);
  if (!file) return [];
  try {
    const parsed = JSON.parse(file.content) as ResultMeta[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeMeta);
  } catch {
    return [];
  }
}

export async function fetchResultFromRepo(
  token: string,
  slug: string,
): Promise<PipelineResultJson | null> {
  const client = createGithubClient(token);
  const file = await getFileContent(client, `out/results/${encodeURIComponent(slug)}.json`);
  if (!file) return null;
  try {
    const data = JSON.parse(file.content) as PipelineResultJson;
    if (data.landing?.slug) {
      data.landing.url = publicLandingUrl(data.landing.slug, data.landing.url);
      data.post.landingUrl = data.landing.url;
    }
    return data;
  } catch {
    return null;
  }
}

/** Static copy on GitHub Pages — can lag behind main until deploy-pages runs. */
export async function fetchResultsIndexFromPages(): Promise<ResultMeta[]> {
  const base = CONFIG.landingBaseUrl || '';
  if (!base) return [];
  const url = cacheBust(`${base}/results/index.json`);
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const parsed = (await res.json()) as ResultMeta[];
    return parsed.map(normalizeMeta);
  } catch {
    return [];
  }
}

export async function fetchResultFromPages(slug: string): Promise<PipelineResultJson | null> {
  const base = CONFIG.landingBaseUrl || '';
  if (!base) return null;
  const url = cacheBust(`${base}/results/${encodeURIComponent(slug)}.json`);
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as PipelineResultJson;
    if (data.landing?.slug) {
      data.landing.url = publicLandingUrl(data.landing.slug, data.landing.url);
      data.post.landingUrl = data.landing.url;
    }
    return data;
  } catch {
    return null;
  }
}

/** Prefer repo (fresh); fallback to Pages for detail JSON if repo file missing. */
export async function fetchResultsIndex(token: string | null): Promise<ResultMeta[]> {
  if (token) {
    const fromRepo = await fetchResultsIndexFromRepo(token);
    if (fromRepo.length > 0) return fromRepo;
  }
  return fetchResultsIndexFromPages();
}

export async function fetchResult(
  token: string | null,
  slug: string,
): Promise<PipelineResultJson | null> {
  if (token) {
    const fromRepo = await fetchResultFromRepo(token, slug);
    if (fromRepo) return fromRepo;
  }
  return fetchResultFromPages(slug);
}
