import { CONFIG } from '../lib/config';
import { createGithubClient, getFileContent, putFileContent } from './github';

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
  sha: string | null;
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

export async function loadSchedulesFromRepo(token: string): Promise<SchedulesFile> {
  const client = createGithubClient(token);
  const file = await getFileContent(client, CONFIG.schedulesPath);
  if (!file) {
    return { schedules: { rules: [] }, sha: null };
  }
  try {
    const parsed = JSON.parse(file.content) as Partial<SchedulesDto>;
    const rules = Array.isArray(parsed.rules) ? parsed.rules : [];
    return {
      schedules: {
        rules: rules.map((r) => ({
          ...r,
          tz: r.tz ?? DEFAULT_TZ,
          enabled: Boolean(r.enabled),
        })) as ScheduleRuleDto[],
      },
      sha: file.sha,
    };
  } catch (err) {
    throw new Error(`schedules.json is not valid JSON: ${(err as Error).message}`);
  }
}

export async function saveSchedulesToRepo(
  token: string,
  schedules: SchedulesDto,
  sha: string | null,
  commitMessage: string,
): Promise<void> {
  const client = createGithubClient(token);
  const json = JSON.stringify(schedules, null, 2) + '\n';
  await putFileContent(client, {
    path: CONFIG.schedulesPath,
    content: json,
    message: commitMessage,
    ...(sha ? { sha } : {}),
  });
}

/**
 * Browser-side uuid (no crypto.subtle needed). Good enough for stable ids.
 */
export function newScheduleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random suffix
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
