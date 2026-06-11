import {
  collection,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { CONFIG } from '../lib/config';
import { getDb } from '../lib/firebase';
import { refs } from './db';

export type ResultStatus = 'success' | 'rejected';

export type RejectionReason =
  | 'no_news'
  | 'low_confidence'
  | 'unknown_country'
  | 'blocked_country'
  | 'no_collections'
  | 'no_fresh_infopovod'
  | 'llm_error';

export interface ResultMeta {
  slug: string;
  createdAt: string;
  newsTitle: string;
  country?: string;
  /** @deprecated legacy field — use collectionsCount */
  toursCount: number;
  collectionsCount: number;
  collectionUrl?: string;
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

export interface CatalogPageJson {
  url: string;
  title: string;
  pageClass: string;
  pageType: string;
  purpose: string;
  tourCount?: number;
}

export interface PipelineResultJson {
  status?: 'success';
  news: { title: string; sourceName: string; sourceUrl: string; summary: string };
  insight: InsightJson;
  primaryCollection: CatalogPageJson;
  collections: CatalogPageJson[];
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
  no_collections: 'Нет подборок',
  no_fresh_infopovod: 'Нет новых инфоповодов',
  llm_error: 'Ошибка LLM',
};

/** Public landing URL from slug (ignores stale landingUrl saved in Firestore). */
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

/**
 * One-shot fetch of the most recent 200 results. The History page uses
 * an onSnapshot subscription instead (see useFirestoreHistory) — this is
 * kept for non-realtime callers and tests.
 */
export async function fetchResultsIndex(): Promise<ResultMeta[]> {
  const q = query(collection(getDb(), 'results'), orderBy('createdAt', 'desc'), limit(200));
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalizeMeta(docToResultMeta(d.data() as ResultDocLike, d.id)));
}

export async function fetchResult(slug: string): Promise<ResultJson | null> {
  const snap = await getDoc(refs.result(slug));
  if (!snap.exists()) return null;
  const data = snap.data() as ResultDocLike;
  const body = data.body;
  if (!body) return null;
  if (isSuccessResult(body) && body.landing?.slug) {
    body.landing.url = publicLandingUrl(body.landing.slug, body.landing.url);
    body.post.landingUrl = body.landing.url;
  }
  return body;
}

interface ResultDocLike {
  slug?: string;
  status?: ResultStatus;
  createdAt?: string;
  newsTitle?: string;
  country?: string | null;
  toursCount?: number;
  collectionsCount?: number;
  collectionUrl?: string | null;
  landingUrl?: string | null;
  rejectionReason?: RejectionReason | null;
  rejectionMessage?: string | null;
  body?: ResultJson;
}

function docToResultMeta(data: ResultDocLike, fallbackSlug: string): ResultMeta {
  const collectionsCount = data.collectionsCount ?? data.toursCount ?? 0;
  return {
    slug: data.slug ?? fallbackSlug,
    createdAt: data.createdAt ?? new Date().toISOString(),
    newsTitle: data.newsTitle ?? '',
    ...(data.country ? { country: data.country } : {}),
    toursCount: collectionsCount,
    collectionsCount,
    ...(data.collectionUrl ? { collectionUrl: data.collectionUrl } : {}),
    ...(data.landingUrl ? { landingUrl: data.landingUrl } : {}),
    status: data.status ?? 'success',
    ...(data.rejectionReason ? { rejectionReason: data.rejectionReason } : {}),
    ...(data.rejectionMessage ? { rejectionMessage: data.rejectionMessage } : {}),
  };
}

export { docToResultMeta };
export type { ResultDocLike };
