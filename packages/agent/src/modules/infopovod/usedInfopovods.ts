import { getDb } from '../../db/firestore.js';
import { logger } from '../../utils/logger.js';
import type { TravelInsight } from '../../types/insight.js';
import type { NewsItem } from '../../types/news.js';
import type { PipelineResult } from '../../types/result.js';
import { infopovodKeyForInsight, normalizeInfopovodTitle } from './infopovodKey.js';

const USED_KEYS_LIMIT = 500;

interface ResultDocLike {
  infopovodKey?: string;
  body?: PipelineResult;
}

function keyFromResultDoc(data: ResultDocLike): string | null {
  if (data.infopovodKey?.trim()) return data.infopovodKey.trim();
  const title = data.body?.news?.title;
  if (title?.trim()) return normalizeInfopovodTitle(title);
  return null;
}

export async function loadUsedInfopovodKeys(): Promise<Set<string>> {
  const snap = await getDb()
    .collection('results')
    .where('status', '==', 'success')
    .orderBy('createdAt', 'desc')
    .limit(USED_KEYS_LIMIT)
    .get();

  const keys = new Set<string>();
  for (const doc of snap.docs) {
    const key = keyFromResultDoc(doc.data() as ResultDocLike);
    if (key) keys.add(key);
  }

  logger.info({ count: keys.size, scanned: snap.size }, 'Loaded used infopovod keys');
  return keys;
}

export function pickFreshInsight(
  insights: TravelInsight[],
  news: NewsItem[],
  usedKeys: Set<string>,
): TravelInsight | null {
  if (insights.length === 0) return null;

  const sorted = [...insights].sort((a, b) => b.confidenceScore - a.confidenceScore);
  for (const insight of sorted) {
    const key = infopovodKeyForInsight(insight, news);
    if (!usedKeys.has(key)) return insight;
  }
  return null;
}

export function countUsedInsights(
  insights: TravelInsight[],
  news: NewsItem[],
  usedKeys: Set<string>,
): number {
  let used = 0;
  for (const insight of insights) {
    if (usedKeys.has(infopovodKeyForInsight(insight, news))) used += 1;
  }
  return used;
}
