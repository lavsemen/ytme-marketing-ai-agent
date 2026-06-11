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
  it('returns rule whose previous tick falls inside the current UTC hour', () => {
    // now = 2026-05-22T10:15:00Z, hourly rule "0 * * * *" — prev = 10:00Z (in current hour)
    const now = new Date('2026-05-22T10:15:00Z');
    const r = rule({ cron: '0 * * * *' });
    const { active, skipped } = decideRulesToRun([r], { now });
    expect(active).toHaveLength(1);
    expect(active[0]!.rule.id).toBe('r1');
    expect(skipped).toHaveLength(0);
  });

  it('fires daily rule within 90 minutes after the tick (GH delay tolerance)', () => {
    // now = 10:15 UTC, daily 09:00 UTC — prev = 09:00Z, elapsed 75m
    const now = new Date('2026-05-22T10:15:00Z');
    const r = rule({ cron: '0 9 * * *', tz: 'UTC' });
    const { active, skipped } = decideRulesToRun([r], { now });
    expect(active).toHaveLength(1);
    expect(skipped).toHaveLength(0);
  });

  it('skips daily rule when previous tick is older than grace window', () => {
    // now = 11:00 UTC, daily 09:00 UTC — elapsed 2h
    const now = new Date('2026-05-22T11:00:00Z');
    const r = rule({ cron: '0 9 * * *', tz: 'UTC' });
    const { active, skipped } = decideRulesToRun([r], { now });
    expect(active).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]!.skipReason).toBe('no-tick-in-window');
  });

  it('fires 18:00 MSK when GitHub job starts in the next UTC hour', () => {
    // 18:00 Europe/Moscow = 15:00 UTC; job starts 16:05 UTC (common GH delay)
    const now = new Date('2026-05-22T16:05:00Z');
    const r = rule({ cron: '0 18 * * *', tz: 'Europe/Moscow' });
    const { active } = decideRulesToRun([r], { now });
    expect(active).toHaveLength(1);
  });

  it('respects TZ when computing prev tick', () => {
    // 09:00 Europe/Moscow on 2026-05-22 == 06:00Z (MSK is UTC+3, no DST)
    // now = 06:30Z → prev tick = 06:00Z → in current hour, should fire
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
      rule({ id: 'a', cron: '0 9 * * *' }),     // would normally be skipped
      rule({ id: 'b', cron: '0 14 * * *' }),    // would normally be skipped
      rule({ id: 'c', cron: '0 * * * *', enabled: false }), // still skipped (disabled)
    ];
    const { active, skipped } = decideRulesToRun(rules, { now, force: true });
    expect(active.map((d) => d.rule.id)).toEqual(['a', 'b']);
    expect(skipped[0]!.skipReason).toBe('disabled');
  });

  it('correctly distributes multiple rules between active and skipped', () => {
    const now = new Date('2026-05-22T10:15:00Z');
    const rules = [
      rule({ id: 'now',  cron: '0 10 * * *', tz: 'UTC' }), // prev = 10:00Z → active
      rule({ id: 'past', cron: '0 8 * * *',  tz: 'UTC' }), // prev = 08:00Z → skipped
      rule({ id: 'msk',  cron: '0 13 * * *', tz: 'Europe/Moscow' }), // 13:00 MSK = 10:00Z → active
    ];
    const { active, skipped } = decideRulesToRun(rules, { now });
    expect(active.map((d) => d.rule.id).sort()).toEqual(['msk', 'now']);
    expect(skipped.map((d) => d.rule.id)).toEqual(['past']);
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
