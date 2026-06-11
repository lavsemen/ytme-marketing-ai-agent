import { describe, it, expect } from 'vitest';
import { mergeSchedules } from '../src/config/agentConfig.js';

describe('mergeSchedules', () => {
  const validRule = {
    id: 'r1',
    enabled: true,
    name: 'Morning',
    cron: '0 9 * * *',
    tz: 'Europe/Moscow',
    source: 'all',
  };

  it('returns valid rules and skips invalid cron without throwing', () => {
    const merged = mergeSchedules({
      rules: [
        validRule,
        { ...validRule, id: 'r2', cron: '18:20' },
        { ...validRule, id: 'r3', cron: '20 18 * * *' },
      ],
    });
    expect(merged.rules).toHaveLength(2);
    expect(merged.rules.map((r) => r.id)).toEqual(['r1', 'r3']);
  });

  it('returns empty list when input is missing', () => {
    expect(mergeSchedules(null).rules).toEqual([]);
    expect(mergeSchedules({}).rules).toEqual([]);
  });
});
