/**
 * Deletes all schedule rules and every run/result created by scheduled triggers.
 * Browser clients cannot delete runs/results (Firestore rules) — use this CLI.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=... yarn workspace @ytme/agent cleanup-scheduled
 *   yarn workspace @ytme/agent cleanup-scheduled --dry-run
 */

import { getDb } from '../db/firestore.js';
import { logger } from '../utils/logger.js';
import { saveSchedules, type ScheduleRule } from '../config/agentConfig.js';

const BATCH_LIMIT = 450;

export interface CleanupScheduledStats {
  rulesCleared: boolean;
  runsDeleted: number;
  resultsDeleted: number;
  metricsDeleted: number;
}

function normalizeScheduleRule(r: Partial<ScheduleRule>): ScheduleRule {
  const base: ScheduleRule = {
    id: r.id ?? '',
    enabled: Boolean(r.enabled),
    name: r.name ?? '',
    cron: r.cron ?? '0 9 * * *',
    tz: r.tz ?? 'Europe/Moscow',
    source: r.source ?? 'all',
  };
  const hint = r.hint?.trim();
  if (hint) base.hint = hint;
  if (r.createdAt) base.createdAt = r.createdAt;
  if (r.updatedAt) base.updatedAt = r.updatedAt;
  return base;
}

async function commitBatch(
  deletes: Array<{ collection: string; id: string }>,
): Promise<number> {
  if (deletes.length === 0) return 0;
  const db = getDb();
  const batch = db.batch();
  for (const { collection, id } of deletes) {
    batch.delete(db.collection(collection).doc(id));
  }
  await batch.commit();
  return deletes.length;
}

export async function cleanupScheduled(options: {
  dryRun?: boolean;
  clearRules?: boolean;
} = {}): Promise<CleanupScheduledStats> {
  const dryRun = Boolean(options.dryRun);
  const clearRules = options.clearRules !== false;
  const db = getDb();

  const runsSnap = await db.collection('runs').where('trigger', '==', 'scheduled').get();
  const resultSlugs = new Set<string>();
  const runIds: string[] = [];

  for (const doc of runsSnap.docs) {
    runIds.push(doc.id);
    const slug = doc.data().resultSlug;
    if (typeof slug === 'string' && slug.trim()) {
      resultSlugs.add(slug.trim());
    }
  }

  // Results may exist without a matching run doc (edge cases / partial writes).
  const resultsSnap = await db.collection('results').get();
  for (const doc of resultsSnap.docs) {
    const data = doc.data();
    const runId = data.runId;
    const triggerFromBody =
      data.body &&
      typeof data.body === 'object' &&
      data.body.meta &&
      typeof data.body.meta === 'object'
        ? (data.body.meta as { trigger?: string }).trigger
        : undefined;
    const isScheduled =
      triggerFromBody === 'scheduled' ||
      (typeof runId === 'string' && runId.startsWith('sched-')) ||
      doc.id.startsWith('rejected-sched-');
    if (isScheduled) {
      resultSlugs.add(doc.id);
    }
  }

  const stats: CleanupScheduledStats = {
    rulesCleared: false,
    runsDeleted: 0,
    resultsDeleted: 0,
    metricsDeleted: 0,
  };

  if (dryRun) {
    logger.info(
      {
        runs: runIds.length,
        results: resultSlugs.size,
        clearRules,
      },
      'Dry run — nothing deleted',
    );
    return {
      ...stats,
      runsDeleted: runIds.length,
      resultsDeleted: resultSlugs.size,
      metricsDeleted: resultSlugs.size,
    };
  }

  const pending: Array<{ collection: string; id: string }> = [];

  async function flush(): Promise<void> {
    if (pending.length === 0) return;
    const chunk = pending.splice(0, BATCH_LIMIT);
    await commitBatch(chunk);
    for (const { collection } of chunk) {
      if (collection === 'runs') stats.runsDeleted += 1;
      else if (collection === 'results') stats.resultsDeleted += 1;
      else if (collection === 'metrics') stats.metricsDeleted += 1;
    }
  }

  for (const runId of runIds) {
    pending.push({ collection: 'runs', id: runId });
    if (pending.length >= BATCH_LIMIT) await flush();
  }

  for (const slug of resultSlugs) {
    pending.push({ collection: 'results', id: slug });
    pending.push({ collection: 'metrics', id: slug });
    if (pending.length >= BATCH_LIMIT) await flush();
  }

  await flush();

  if (clearRules) {
    await saveSchedules({ rules: [] });
    stats.rulesCleared = true;
    logger.info('Schedule rules cleared (config/schedules → rules: [])');
  }

  logger.info(stats, 'Scheduled cleanup complete');
  return stats;
}
