import { logger } from './utils/logger.js';
import { runPipeline } from './pipeline.js';
import type { PipelineRunResult } from './types/result.js';

export interface RunGenerationInput {
  sourceId?: string;
  runId?: string;
  hint?: string;
  trigger: 'manual' | 'scheduled';
}

/**
 * Single entry point for manual (`generate`) and scheduled runs.
 * Same pipeline, Slack notifications, Firestore persistence — only `trigger` differs.
 */
export async function runGeneration(input: RunGenerationInput): Promise<PipelineRunResult> {
  const sourceId = input.sourceId?.trim() || undefined;
  const hint = input.hint?.trim() || undefined;
  const runId = input.runId?.trim() || undefined;

  logger.info(
    {
      trigger: input.trigger,
      sourceId: sourceId ?? 'all',
      runId: runId ?? null,
      hint: hint ?? null,
    },
    'Starting generation',
  );

  return runPipeline({
    ...(sourceId ? { sourceId } : {}),
    ...(runId ? { runId } : {}),
    ...(hint ? { hint } : {}),
    trigger: input.trigger,
  });
}
