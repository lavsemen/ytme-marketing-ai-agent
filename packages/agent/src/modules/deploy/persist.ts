import { getDb } from '../../db/firestore.js';
import { logger } from '../../utils/logger.js';
import type {
  PipelineResult,
  RejectedPipelineResult,
} from '../../types/result.js';

/**
 * Pipeline persistence layer — writes results and run lifecycle to Firestore.
 *
 * Collections:
 *  - results/{slug}  — full PipelineResult or RejectedPipelineResult body,
 *    plus flattened "card" fields for the History page list query.
 *  - runs/{runId}    — lifecycle doc (in_progress → completed / failed) so
 *    the admin UI can render live status without polling GitHub Actions.
 */

interface StartRunInput {
  runId: string;
  source?: string | undefined;
  hint?: string | undefined;
  trigger: 'manual' | 'scheduled';
}

interface FinishRunInput {
  runId: string;
  resultSlug: string;
  resultStatus: 'success' | 'rejected';
}

interface FailRunInput {
  runId: string;
  errorMessage: string;
}

export async function startRun(input: StartRunInput): Promise<void> {
  await getDb()
    .collection('runs')
    .doc(input.runId)
    .set(
      {
        runId: input.runId,
        status: 'in_progress',
        trigger: input.trigger,
        source: input.source ?? null,
        hint: input.hint ?? null,
        startedAt: new Date().toISOString(),
      },
      { merge: true },
    );
}

export async function finishRun(input: FinishRunInput): Promise<void> {
  await getDb()
    .collection('runs')
    .doc(input.runId)
    .set(
      {
        status: 'completed',
        finishedAt: new Date().toISOString(),
        resultSlug: input.resultSlug,
        resultStatus: input.resultStatus,
      },
      { merge: true },
    );
}

export async function failRun(input: FailRunInput): Promise<void> {
  await getDb()
    .collection('runs')
    .doc(input.runId)
    .set(
      {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        errorMessage: input.errorMessage,
      },
      { merge: true },
    );
}

function rejectedSlug(reject: RejectedPipelineResult): string {
  const runId = reject.meta.runId;
  const ts = reject.meta.createdAt.replace(/[:.]/g, '-');
  const base = runId ? `rejected-${runId}` : `rejected-${ts}`;
  return base.toLowerCase();
}

export async function persistSuccess(result: PipelineResult): Promise<void> {
  const db = getDb();
  const slug = result.landing.slug;
  const batch = db.batch();
  batch.set(db.collection('results').doc(slug), {
    slug,
    status: 'success',
    createdAt: result.meta.createdAt,
    runId: result.meta.runId ?? null,
    newsTitle: result.news.title,
    country: result.insight.country ?? null,
    toursCount: result.tours.length,
    landingUrl: result.landing.url,
    body: result,
  });
  if (result.meta.runId) {
    batch.set(
      db.collection('runs').doc(result.meta.runId),
      {
        status: 'completed',
        finishedAt: new Date().toISOString(),
        resultSlug: slug,
        resultStatus: 'success',
      },
      { merge: true },
    );
  }
  await batch.commit();
  logger.info({ slug }, 'Result persisted (Firestore)');
}

export async function persistRejection(
  result: RejectedPipelineResult,
): Promise<string> {
  const db = getDb();
  const slug = rejectedSlug(result);
  const batch = db.batch();
  batch.set(db.collection('results').doc(slug), {
    slug,
    status: 'rejected',
    createdAt: result.meta.createdAt,
    runId: result.meta.runId ?? null,
    newsTitle:
      result.newsSampled[0]?.title ??
      result.topInsight?.title ??
      `Run skipped (${result.reason})`,
    country: result.topInsight?.country ?? null,
    toursCount: 0,
    rejectionReason: result.reason,
    rejectionMessage: result.message,
    body: result,
  });
  if (result.meta.runId) {
    batch.set(
      db.collection('runs').doc(result.meta.runId),
      {
        status: 'completed',
        finishedAt: new Date().toISOString(),
        resultSlug: slug,
        resultStatus: 'rejected',
      },
      { merge: true },
    );
  }
  await batch.commit();
  logger.info({ slug, reason: result.reason }, 'Rejected run persisted (Firestore)');
  return slug;
}

/**
 * Reads the list of result cards for the agent CLI `list` command.
 * Mirrors what the admin SPA renders so output stays consistent.
 */
export interface ResultCard {
  slug: string;
  createdAt: string;
  status: 'success' | 'rejected';
  country: string | null;
  toursCount: number;
  landingUrl: string | null;
  newsTitle: string;
}

export async function listResults(limit = 50): Promise<ResultCard[]> {
  const snap = await getDb()
    .collection('results')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => {
    const data = d.data() as Partial<ResultCard>;
    return {
      slug: data.slug ?? d.id,
      createdAt: data.createdAt ?? '',
      status: data.status ?? 'success',
      country: data.country ?? null,
      toursCount: data.toursCount ?? 0,
      landingUrl: data.landingUrl ?? null,
      newsTitle: data.newsTitle ?? '',
    };
  });
}
