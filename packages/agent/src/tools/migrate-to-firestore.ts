/**
 * One-off migration: reads any pre-Firestore JSON files (sources.json,
 * prompts.json, settings.json, schedules.json, out/results/*.json) from the
 * working tree and pushes them into Firestore. Idempotent: re-running
 * skips `results/{slug}` that already exist; configs use `set({ merge: true })`.
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=... \
 *   FIREBASE_SERVICE_ACCOUNT_JSON='{...}' \
 *   yarn workspace @ytme/agent migrate-firestore
 */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { AGENT_ROOT, RESULTS_DIR, readJsonIfExists, pathExists } from '../utils/fs.js';
import { getDb } from '../db/firestore.js';
import { logger } from '../utils/logger.js';
import {
  mergeSchedules,
  mergeSettings,
  type PromptsConfig,
} from '../config/agentConfig.js';
import { DEFAULT_PROMPTS } from '../modules/ai/prompts.js';
import { SourcesFileSchema } from '../config/sources.schema.js';

const CONFIG_DIR = path.join(AGENT_ROOT, 'src', 'config');

interface MigrationStats {
  configs: number;
  results: number;
  resultsSkipped: number;
}

async function migrateConfig(
  docId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const ref = getDb().collection('config').doc(docId);
  await ref.set(
    { ...payload, updatedAt: new Date().toISOString() },
    { merge: true },
  );
  logger.info({ docId, keys: Object.keys(payload) }, 'Migrated config doc');
}

async function migrateSources(): Promise<boolean> {
  const file = path.join(CONFIG_DIR, 'sources.json');
  const raw = await readJsonIfExists<unknown>(file);
  if (!raw) {
    logger.warn({ file }, 'sources.json not found, skipping');
    return false;
  }
  const parsed = SourcesFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`sources.json validation failed: ${parsed.error.message}`);
  }
  await migrateConfig('sources', { items: parsed.data });
  return true;
}

async function migratePrompts(): Promise<boolean> {
  const file = path.join(CONFIG_DIR, 'prompts.json');
  const raw = await readJsonIfExists<PromptsConfig>(file);
  if (!raw) {
    // Fall back to compile-time defaults so the agent starts up cleanly.
    await migrateConfig('prompts', DEFAULT_PROMPTS as unknown as Record<string, unknown>);
    return true;
  }
  await migrateConfig('prompts', raw as unknown as Record<string, unknown>);
  return true;
}

async function migrateSettings(): Promise<boolean> {
  const file = path.join(CONFIG_DIR, 'settings.json');
  const raw = await readJsonIfExists<unknown>(file);
  const settings = mergeSettings(raw ?? {});
  await migrateConfig('settings', settings as unknown as Record<string, unknown>);
  return true;
}

async function migrateSchedules(): Promise<boolean> {
  const file = path.join(CONFIG_DIR, 'schedules.json');
  const raw = await readJsonIfExists<unknown>(file);
  const schedules = mergeSchedules(raw ?? {});
  await migrateConfig('schedules', schedules as unknown as Record<string, unknown>);
  return true;
}

async function migrateResults(): Promise<{ migrated: number; skipped: number }> {
  if (!(await pathExists(RESULTS_DIR))) {
    logger.info({ dir: RESULTS_DIR }, 'No results directory yet, nothing to migrate');
    return { migrated: 0, skipped: 0 };
  }
  const entries = await fs.readdir(RESULTS_DIR);
  const resultFiles = entries.filter(
    (f) => f.endsWith('.json') && f !== 'index.json',
  );
  let migrated = 0;
  let skipped = 0;
  for (const file of resultFiles) {
    const slug = file.replace(/\.json$/, '');
    const fullPath = path.join(RESULTS_DIR, file);
    const body = await readJsonIfExists<Record<string, unknown>>(fullPath);
    if (!body) continue;
    const ref = getDb().collection('results').doc(slug);
    const existing = await ref.get();
    if (existing.exists) {
      skipped += 1;
      continue;
    }
    const status = (body.status as string | undefined) === 'rejected' ? 'rejected' : 'success';
    const news = body.news as { title?: string } | undefined;
    const insight = body.insight as { country?: string } | undefined;
    const tours = body.tours as unknown[] | undefined;
    const landing = body.landing as { url?: string } | undefined;
    const meta = body.meta as { createdAt?: string; runId?: string } | undefined;
    await ref.set({
      slug,
      status,
      createdAt: meta?.createdAt ?? new Date().toISOString(),
      ...(meta?.runId ? { runId: meta.runId } : {}),
      newsTitle: news?.title ?? (body.message as string | undefined) ?? slug,
      country: insight?.country ?? null,
      toursCount: Array.isArray(tours) ? tours.length : 0,
      landingUrl: landing?.url ?? null,
      ...(status === 'rejected'
        ? {
            rejectionReason: (body.reason as string | undefined) ?? null,
            rejectionMessage: (body.message as string | undefined) ?? null,
          }
        : {}),
      body,
    });
    migrated += 1;
  }
  logger.info({ migrated, skipped, total: resultFiles.length }, 'Results migrated');
  return { migrated, skipped };
}

async function main(): Promise<void> {
  const stats: MigrationStats = { configs: 0, results: 0, resultsSkipped: 0 };
  if (await migrateSources()) stats.configs += 1;
  if (await migratePrompts()) stats.configs += 1;
  if (await migrateSettings()) stats.configs += 1;
  if (await migrateSchedules()) stats.configs += 1;

  const r = await migrateResults();
  stats.results = r.migrated;
  stats.resultsSkipped = r.skipped;

  logger.info(stats, 'Migration complete');
  process.stdout.write(JSON.stringify({ ok: true, ...stats }) + '\n');
}

main().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
