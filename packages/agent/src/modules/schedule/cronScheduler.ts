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
  /** next cron tick after `now` (in UTC) — end of the current slot window */
  nextTick?: Date;
  /** absolute reason for not-running, populated only for skipped rules */
  skipReason?: 'disabled' | 'no-tick-in-window' | 'invalid-cron';
  /** parse error message if cron expression failed to compile */
  error?: string;
}

/**
 * A rule is due while `now` is in `[prevTick, nextTick)` — the half-open interval
 * between two consecutive cron fires. GitHub Actions may start hours late; dedup
 * via `lastFiredPrevTick` ensures each slot runs at most once.
 */
function isInSlotWindow(prev: Date, next: Date, now: Date): boolean {
  const t = now.getTime();
  return t >= prev.getTime() && t < next.getTime();
}

/**
 * Determine which schedule rules should be executed right now.
 *
 *  - disabled rules are skipped
 *  - rules with an invalid cron expression are skipped with reason
 *  - in normal mode: a rule fires if `now` is in [prevTick, nextTick)
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
    let next: Date;
    try {
      const interval = CronExpressionParser.parse(rule.cron, {
        currentDate: now,
        tz: rule.tz,
      });
      prev = interval.prev().toDate();
      next = interval.next().toDate();
    } catch (err) {
      skipped.push({
        rule,
        prevTick: now,
        skipReason: 'invalid-cron',
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (opts.force || isInSlotWindow(prev, next, now)) {
      active.push({ rule, prevTick: prev, nextTick: next });
    } else {
      skipped.push({ rule, prevTick: prev, nextTick: next, skipReason: 'no-tick-in-window' });
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
