import { CronExpressionParser } from 'cron-parser';
import type { ScheduleRule } from '../../config/agentConfig.js';

/** How long after a cron tick a rule stays eligible (covers GitHub Actions queue delay). */
export const SCHEDULER_GRACE_MS = 90 * 60 * 1000;

export interface DecideOptions {
  /**
   * When true, time-window filtering is bypassed and every enabled rule
   * is returned. Use for manual `workflow_dispatch` / debugging.
   */
  force?: boolean;
  /**
   * Current moment (injectable for tests). Defaults to `new Date()`.
   */
  now?: Date;
}

export interface SchedulerDecision {
  rule: ScheduleRule;
  /** prev cron tick that triggered this decision (in UTC) */
  prevTick: Date;
  /** absolute reason for not-running, populated only for skipped rules */
  skipReason?: 'disabled' | 'no-tick-in-window' | 'invalid-cron';
  /** parse error message if cron expression failed to compile */
  error?: string;
}

/**
 * A rule is due when its previous cron tick (in rule.tz) was recent enough.
 * GitHub's hourly workflow often starts several minutes (sometimes >1h) late;
 * a fixed UTC-hour window caused missed runs (e.g. 18:00 MSK = 15:00 UTC tick
 * skipped when the job started at 16:05 UTC).
 */
function isTickDue(prev: Date, now: Date): boolean {
  const elapsed = now.getTime() - prev.getTime();
  return elapsed >= 0 && elapsed < SCHEDULER_GRACE_MS;
}

/**
 * Determine which schedule rules should be executed right now.
 *
 *  - disabled rules are skipped
 *  - rules with an invalid cron expression are skipped with reason
 *  - in normal mode: a rule fires if its previous cron tick (in its own tz)
 *    was less than {@link SCHEDULER_GRACE_MS} ago
 *  - in `force` mode: every enabled rule fires regardless of timing
 *
 * Returns BOTH active and skipped decisions so callers can log skipping reasons.
 */
export function decideRulesToRun(
  rules: ScheduleRule[],
  opts: DecideOptions = {},
): { active: SchedulerDecision[]; skipped: SchedulerDecision[] } {
  const now = opts.now ?? new Date();
  const active: SchedulerDecision[] = [];
  const skipped: SchedulerDecision[] = [];

  for (const rule of rules) {
    if (!rule.enabled) {
      skipped.push({ rule, prevTick: now, skipReason: 'disabled' });
      continue;
    }

    let prev: Date;
    try {
      const interval = CronExpressionParser.parse(rule.cron, {
        currentDate: now,
        tz: rule.tz,
      });
      prev = interval.prev().toDate();
    } catch (err) {
      skipped.push({
        rule,
        prevTick: now,
        skipReason: 'invalid-cron',
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (opts.force || isTickDue(prev, now)) {
      active.push({ rule, prevTick: prev });
    } else {
      skipped.push({ rule, prevTick: prev, skipReason: 'no-tick-in-window' });
    }
  }

  return { active, skipped };
}

/**
 * Return the next N upcoming runs for a cron expression in the given timezone.
 * Used by the admin UI to preview a schedule before saving.
 */
export function previewNextRuns(
  cron: string,
  tz: string,
  count = 3,
  now: Date = new Date(),
): Date[] {
  const interval = CronExpressionParser.parse(cron, { currentDate: now, tz });
  const out: Date[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(interval.next().toDate());
  }
  return out;
}

/**
 * Validate a cron expression. Returns null on success, a human-readable
 * error message on failure. Used both by CLI and admin UI (admin imports
 * cron-parser directly, but uses this same wrapper for consistent errors).
 */
export function validateCron(cron: string, tz = 'UTC'): string | null {
  try {
    CronExpressionParser.parse(cron, { tz });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
