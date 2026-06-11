import { describe, it, expect } from 'vitest';
import { decideRulesToRun, previewNextRuns, validateCron } from '../src/modules/schedule/cronScheduler.js';
import type { ScheduleRule } from '../src/config/agentConfig.js';

function rule(over: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: over.id ?? 'r1',
    enabled: over.enabled ?? true,
    name: over.name ?? 'Rule',
    cron: over.cron ?? '0 * * * *', // hourly at :00
    tz: over.tz ?? 'UTC',
    source: over.source ?? 'all',
    ...(over.hint !== undefined ? { hint: over.hint } : {}),
  };
}

describe('cronScheduler › decideRulesToRun', () => {
  it('returns rule when now is inside [prevTick, nextTick)', () => {
    const now = new Date('2026-05-22T10:15:00Z');
    const r = rule({ cron: '0 * * * *' });
    const { active, skipped } = decideRulesToRun([r], { now });
    expect(active).toHaveLength(1);
    expect(active[0]!.rule.id).toBe('r1');
    expect(skipped).toHaveLength(0);
  });

  it('fires daily rule many hours after the tick (GH delay tolerance)', () => {
    // now = 15:00 UTC, daily 09:00 UTC — still in slot until next day 09:00
    const now = new Date('2026-05-22T15:00:00Z');
    const r = rule({ cron: '0 9 * * *', tz: 'UTC' });
    const { active, skipped } = decideRulesToRun([r], { now });
    expect(active).toHaveLength(1);
    expect(skipped).toHaveLength(0);
  });

  it('keeps rule eligible until the next cron tick (catch-up after GH delay)', () => {
    const now = new Date('2026-05-22T08:30:00Z');
    const r = rule({ cron: '0 9 * * *', tz: 'UTC' });
    const { active } = decideRulesToRun([r], { now });
    expect(active).toHaveLength(1);
    expect(active[0]!.prevTick.toISOString()).toBe('2026-05-21T09:00:00.000Z');
  });

  it('fires 09:00 MSK rule at 15:00 UTC same day (6h after tick)', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const r = rule({ cron: '0 9 * * *', tz: 'Europe/Moscow' });
    const { active } = decideRulesToRun([r], { now });
    expect(active).toHaveLength(1);
    expect(active[0]!.prevTick.toISOString()).toBe('2026-06-15T06:00:00.000Z');
  });

  it('fires 18:00 MSK when GitHub job starts in the next UTC hour', () => {
    const now = new Date('2026-05-22T16:05:00Z');
    const r = rule({ cron: '0 18 * * *', tz: 'Europe/Moscow' });
    const { active } = decideRulesToRun([r], { now });
    expect(active).toHaveLength(1);
  });

  it('respects TZ when computing prev tick', () => {
    const now = new Date('2026-05-22T06:30:00Z');
    const r = rule({ cron: '0 9 * * *', tz: 'Europe/Moscow' });
    const { active } = decideRulesToRun([r], { now });
    expect(active).toHaveLength(1);
  });

  it('skips disabled rules even if their tick is due', () => {
    const now = new Date('2026-05-22T10:15:00Z');
    const r = rule({ cron: '0 * * * *', enabled: false });
    const { active, skipped } = decideRulesToRun([r], { now });
    expect(active).toHaveLength(0);
    expect(skipped[0]!.skipReason).toBe('disabled');
  });

  it('catches invalid cron expressions', () => {
    const now = new Date('2026-05-22T10:15:00Z');
    const r = rule({ cron: 'totally not cron' });
    const { active, skipped } = decideRulesToRun([r], { now });
    expect(active).toHaveLength(0);
    expect(skipped[0]!.skipReason).toBe('invalid-cron');
    expect(skipped[0]!.error).toBeTruthy();
  });

  it('force=true returns every enabled rule regardless of time', () => {
    const now = new Date('2026-05-22T10:15:00Z');
    const rules = [
      rule({ id: 'a', cron: '0 9 * * *' }),
      rule({ id: 'b', cron: '0 14 * * *' }),
      rule({ id: 'c', cron: '0 * * * *', enabled: false }),
    ];
    const { active, skipped } = decideRulesToRun(rules, { now, force: true });
    expect(active.map((d) => d.rule.id)).toEqual(['a', 'b']);
    expect(skipped[0]!.skipReason).toBe('disabled');
  });

  it('correctly distributes multiple rules between active and skipped', () => {
    const now = new Date('2026-05-22T10:15:00Z');
    const rules = [
      rule({ id: 'now', cron: '0 10 * * *', tz: 'UTC' }),
      rule({ id: 'past', cron: '0 8 * * *', tz: 'UTC' }),
      rule({ id: 'msk', cron: '0 13 * * *', tz: 'Europe/Moscow' }),
    ];
    const { active, skipped } = decideRulesToRun(rules, { now });
    expect(active.map((d) => d.rule.id).sort()).toEqual(['msk', 'now', 'past']);
    expect(skipped).toHaveLength(0);
  });
});

describe('cronScheduler › previewNextRuns', () => {
  it('returns N upcoming runs in the given timezone', () => {
    const now = new Date('2026-05-22T10:15:00Z');
    const runs = previewNextRuns('0 9 * * *', 'UTC', 3, now);
    expect(runs).toHaveLength(3);
    expect(runs[0]!.toISOString()).toBe('2026-05-23T09:00:00.000Z');
    expect(runs[1]!.toISOString()).toBe('2026-05-24T09:00:00.000Z');
    expect(runs[2]!.toISOString()).toBe('2026-05-25T09:00:00.000Z');
  });

  it('throws on invalid cron', () => {
    expect(() => previewNextRuns('nope', 'UTC', 1)).toThrow();
  });
});

describe('cronScheduler › validateCron', () => {
  it('returns null for valid expressions', () => {
    expect(validateCron('0 9 * * *')).toBeNull();
    expect(validateCron('*/15 * * * *')).toBeNull();
    expect(validateCron('0 9-18 * * 1-5')).toBeNull();
  });

  it('returns error message for invalid expressions', () => {
    const err = validateCron('totally not cron');
    expect(err).toBeTruthy();
    expect(typeof err).toBe('string');
  });
});
