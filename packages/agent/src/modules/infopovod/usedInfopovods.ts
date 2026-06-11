import { getDb } from '../../db/firestore.js';
import { logger } from '../../utils/logger.js';
import type { TravelInsight } from '../../types/insight.js';
import type { NewsItem } from '../../types/news.js';
import type { PipelineResult } from '../../types/result.js';
import { infopovodKeyForInsight, normalizeInfopovodTitle } from './infopovodKey.js';

const USED_KEYS_LIMIT = 500;
/** Scan more docs than needed — recent runs may include rejected entries. */
const SCAN_LIMIT = 1500;

interface ResultDocLike {
  infopovodKey?: string;
  status?: string;
  body?: PipelineResult;
}

function keyFromResultDoc(data: ResultDocLike): string | null {
  if (data.infopovodKey?.trim()) return data.infopovodKey.trim();
  const title = data.body?.news?.title;
  if (title?.trim()) return normalizeInfopovodTitle(title);
  return null;
}

function keysFromDocs(docs: Array<{ data: () => ResultDocLike }>): Set<string> {
  const keys = new Set<string>();
  let successScanned = 0;
  for (const doc of docs) {
    const data = doc.data() as ResultDocLike;
    if (data.status !== 'success') continue;
    const key = keyFromResultDoc(data);
    if (key) keys.add(key);
    successScanned += 1;
    if (successScanned >= USED_KEYS_LIMIT) break;
  }
  return keys;
}

export async function loadUsedInfopovodKeys(): Promise<Set<string>> {
  const db = getDb();

  // Single-field orderBy — no composite index required (works before index deploy).
  const snap = await db
    .collection('results')
    .orderBy('createdAt', 'desc')
    .limit(SCAN_LIMIT)
    .get();

  const keys = keysFromDocs(snap.docs);
  logger.info(
    { count: keys.size, scanned: snap.size, successCap: USED_KEYS_LIMIT },
    'Loaded used infopovod keys',
  );
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
