import { CONFIG } from '../lib/config';

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

function cacheBust(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${Date.now()}`;
}

export async function fetchResultsIndex(): Promise<ResultMeta[]> {
  const base = CONFIG.landingBaseUrl || '';
  const url = cacheBust(`${base}/results/index.json`);
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    return (await res.json()) as ResultMeta[];
  } catch {
    return [];
  }
}

export async function fetchResult(slug: string): Promise<PipelineResultJson | null> {
  const base = CONFIG.landingBaseUrl || '';
  const url = cacheBust(`${base}/results/${encodeURIComponent(slug)}.json`);
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as PipelineResultJson;
  } catch {
    return null;
  }
}
