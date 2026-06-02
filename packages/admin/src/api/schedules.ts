import { getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getDb } from '../lib/firebase';
import { refs } from './db';

export const SCHEDULES_MAX_ENABLED = 10;

export interface ScheduleRuleDto {
  id: string;
  enabled: boolean;
  name: string;
  cron: string;
  tz: string;
  source: string; // 'all' or sourceId
  hint?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SchedulesDto {
  rules: ScheduleRuleDto[];
}

export interface SchedulesFile {
  schedules: SchedulesDto;
}

export const DEFAULT_TZ = 'Europe/Moscow';

export const TZ_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Europe/Moscow', label: 'Europe/Moscow (МСК, UTC+3)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/Kaliningrad', label: 'Europe/Kaliningrad (UTC+2)' },
  { value: 'Asia/Yekaterinburg', label: 'Asia/Yekaterinburg (UTC+5)' },
  { value: 'Asia/Novosibirsk', label: 'Asia/Novosibirsk (UTC+7)' },
  { value: 'Asia/Vladivostok', label: 'Asia/Vladivostok (UTC+10)' },
];

export interface CronPreset {
  label: string;
  cron: string;
  description: string;
}

export const CRON_PRESETS: CronPreset[] = [
  { label: 'Каждый день 09:00', cron: '0 9 * * *', description: 'Один раз в сутки утром' },
  { label: 'Каждый день 14:00', cron: '0 14 * * *', description: 'В обед' },
  { label: 'Каждый день 21:00', cron: '0 21 * * *', description: 'Вечером' },
  { label: 'По будням 10:00', cron: '0 10 * * 1-5', description: 'Понедельник–пятница' },
  { label: '2 раза в день (09, 18)', cron: '0 9,18 * * *', description: 'Утром и вечером' },
  { label: '3 раза в день (09, 14, 20)', cron: '0 9,14,20 * * *', description: 'Утром, днём и вечером' },
  { label: 'Каждые 6 часов', cron: '0 */6 * * *', description: '00, 06, 12, 18' },
  { label: 'По понедельникам 09:00', cron: '0 9 * * 1', description: 'Раз в неделю' },
];

function normalizeRule(r: Partial<ScheduleRuleDto>): ScheduleRuleDto {
  return {
    ...r,
    tz: r.tz ?? DEFAULT_TZ,
    enabled: Boolean(r.enabled),
  } as ScheduleRuleDto;
}

export async function loadSchedules(): Promise<SchedulesFile> {
  const snap = await getDoc(refs.schedules());
  if (!snap.exists()) return { schedules: { rules: [] } };
  const data = snap.data() as Partial<SchedulesDto>;
  const rules = Array.isArray(data.rules) ? data.rules : [];
  return { schedules: { rules: rules.map(normalizeRule) } };
}

/**
 * Mutator-style update — receives the fresh list from Firestore so callers
 * can de-dupe by id and never overwrite concurrent edits silently.
 */
export async function applyScheduleChange(
  mutator: (current: SchedulesDto) => SchedulesDto,
): Promise<SchedulesDto> {
  let computed: SchedulesDto = { rules: [] };
  await runTransaction(getDb(), async (t) => {
    const ref = refs.schedules();
    const snap = await t.get(ref);
    const current: SchedulesDto = snap.exists()
      ? {
          rules: Array.isArray(snap.data()?.rules)
            ? (snap.data()!.rules as ScheduleRuleDto[]).map(normalizeRule)
            : [],
        }
      : { rules: [] };
    const next = mutator(current);
    computed = next;
    t.set(ref, {
      ...next,
      updatedAt: serverTimestamp() as unknown as string,
    });
  });
  return computed;
}

/**
 * Browser-side uuid (no crypto.subtle needed). Good enough for stable ids.
 */
export function newScheduleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
