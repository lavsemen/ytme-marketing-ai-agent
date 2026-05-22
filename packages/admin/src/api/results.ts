import { CONFIG } from '../lib/config';
import { createGithubClient, getFileContent } from './github';

export type ResultStatus = 'success' | 'rejected';

export type RejectionReason =
  | 'no_news'
  | 'low_confidence'
  | 'unknown_country'
  | 'blocked_country'
  | 'no_tours'
  | 'llm_error';

export interface ResultMeta {
  slug: string;
  createdAt: string;
  newsTitle: string;
  country?: string;
  toursCount: number;
  landingUrl?: string;
  status?: ResultStatus;
  rejectionReason?: RejectionReason;
  rejectionMessage?: string;
}

export interface InsightJson {
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
  reasonWhyRelevant?: string;
}

export interface ResultMetaJson {
  createdAt: string;
  agentVersion: string;
  runId?: string;
  hint?: string;
  settingsSnapshot?: {
    brandName?: string;
    brandVoice?: string;
    defaultAudience?: string;
    model?: string;
    confidenceThreshold?: number;
  };
}

export interface PipelineResultJson {
  status?: 'success';
  news: { title: string; sourceName: string; sourceUrl: string; summary: string };
  insight: InsightJson;
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
  meta: ResultMetaJson;
}

export interface RejectedResultJson {
  status: 'rejected';
  reason: RejectionReason;
  message: string;
  sourceId?: string;
  newsSampled: { title: string; url: string; sourceName: string }[];
  insights: InsightJson[];
  topInsight?: InsightJson;
  meta: ResultMetaJson;
}

export type ResultJson = PipelineResultJson | RejectedResultJson;

export function isRejectedResult(r: ResultJson): r is RejectedResultJson {
  return r.status === 'rejected';
}

export function isSuccessResult(r: ResultJson): r is PipelineResultJson {
  return r.status !== 'rejected';
}

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  no_news: 'Нет новостей',
  low_confidence: 'Низкая релевантность',
  unknown_country: 'Не определена страна',
  blocked_country: 'Страна в чёрном списке',
  no_tours: 'Мало туров',
  llm_error: 'Ошибка LLM',
};

/** Public landing URL from slug (ignores stale landingUrl saved in index.json). */
export function publicLandingUrl(slug: string, fallback?: string): string {
  if (CONFIG.landingBaseUrl) {
    return `${CONFIG.landingBaseUrl}/landings/${encodeURIComponent(slug)}/`;
  }
  return fallback ?? '';
}

function normalizeMeta(entry: ResultMeta): ResultMeta {
  const status: ResultStatus = entry.status ?? 'success';
  if (status === 'rejected') {
    return { ...entry, status };
  }
  return {
    ...entry,
    status,
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
): Promise<ResultJson | null> {
  const client = createGithubClient(token);
  const file = await getFileContent(client, `out/results/${encodeURIComponent(slug)}.json`);
  if (!file) return null;
  try {
    const data = JSON.parse(file.content) as ResultJson;
    if (isSuccessResult(data) && data.landing?.slug) {
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

export async function fetchResultFromPages(slug: string): Promise<ResultJson | null> {
  const base = CONFIG.landingBaseUrl || '';
  if (!base) return null;
  const url = cacheBust(`${base}/results/${encodeURIComponent(slug)}.json`);
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as ResultJson;
    if (isSuccessResult(data) && data.landing?.slug) {
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
): Promise<ResultJson | null> {
  if (token) {
    const fromRepo = await fetchResultFromRepo(token, slug);
    if (fromRepo) return fromRepo;
  }
  return fetchResultFromPages(slug);
}
