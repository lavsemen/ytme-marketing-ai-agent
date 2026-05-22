import path from 'node:path';
import { RESULTS_DIR, readJsonIfExists, writeJson } from '../../utils/fs.js';
import {
  ResultIndexSchema,
  type ResultIndex,
  type ResultMeta,
} from '../../types/result.js';
import type { PipelineResult } from '../../types/result.js';
import { logger } from '../../utils/logger.js';

const INDEX_FILE = path.join(RESULTS_DIR, 'index.json');

function resultPath(slug: string): string {
  return path.join(RESULTS_DIR, `${slug}.json`);
}

export async function saveResult(result: PipelineResult): Promise<void> {
  await writeJson(resultPath(result.landing.slug), result);
  logger.info({ slug: result.landing.slug }, 'Result JSON saved');
}

async function loadIndex(): Promise<ResultIndex> {
  const raw = await readJsonIfExists<unknown>(INDEX_FILE);
  if (!raw) return [];
  const parsed = ResultIndexSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'Results index invalid, starting fresh');
    return [];
  }
  return parsed.data;
}

export async function updateIndex(result: PipelineResult): Promise<void> {
  const index = await loadIndex();
  const meta: ResultMeta = {
    slug: result.landing.slug,
    createdAt: result.meta.createdAt,
    newsTitle: result.news.title,
    toursCount: result.tours.length,
    landingUrl: result.landing.url,
    ...(result.insight.country ? { country: result.insight.country } : {}),
  };

  const without = index.filter((m) => m.slug !== meta.slug);
  without.unshift(meta);

  await writeJson(INDEX_FILE, without);
  logger.info({ entries: without.length }, 'Results index updated');
}

export async function listResults(): Promise<ResultIndex> {
  return loadIndex();
}
