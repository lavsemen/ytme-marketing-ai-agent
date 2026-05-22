import { CronExpressionParser } from 'cron-parser';
import type { ScheduleRule } from '../../config/agentConfig.js';

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
 * Start of the current hour in UTC. The scheduler treats a rule as "due"
 * if its previous cron tick (any tz) is >= this moment. That guarantees
 * at most one run per cron tick even when the GitHub Actions hourly trigger
 * fires multiple times within a wide jitter window.
 */
function hourStartUtc(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCMinutes(0, 0, 0);
  return d;
}

/**
 * Determine which schedule rules should be executed right now.
 *
 *  - disabled rules are skipped
 *  - rules with an invalid cron expression are skipped with reason
 *  - in normal mode: a rule fires if its previous cron tick (in its own tz)
 *    falls inside the current UTC hour window
 *  - in `force` mode: every enabled rule fires regardless of timing
 *
 * Returns BOTH active and skipped decisions so callers can log skipping reasons.
 */
export function decideRulesToRun(
  rules: ScheduleRule[],
  opts: DecideOptions = {},
): { active: SchedulerDecision[]; skipped: SchedulerDecision[] } {
  const now = opts.now ?? new Date();
  const cutoff = hourStartUtc(now);
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

    if (opts.force || prev.getTime() >= cutoff.getTime()) {
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
