import { CONFIG } from '../lib/config';
import {
  commitJsonAtomic,
  createGithubClient,
  getFileContent,
  putFileContent,
} from './github';

export const BRAND_VOICES = ['friendly', 'formal', 'playful', 'luxury'] as const;
export type BrandVoice = (typeof BRAND_VOICES)[number];

export const BRAND_AUDIENCES = ['mixed', 'family', 'solo', 'premium', 'budget'] as const;
export type BrandAudience = (typeof BRAND_AUDIENCES)[number];

export const VOICE_LABELS: Record<BrandVoice, string> = {
  friendly: 'Дружелюбный',
  formal: 'Формальный',
  playful: 'Игривый',
  luxury: 'Премиум',
};

export const AUDIENCE_LABELS: Record<BrandAudience, string> = {
  mixed: 'Смешанная',
  family: 'Семьи с детьми',
  solo: 'Одиночки',
  premium: 'Премиум',
  budget: 'Бюджетные',
};

export const MONTH_RANGE_KEYS = ['12-02', '03-05', '06-08', '09-11'] as const;
export type MonthRangeKey = (typeof MONTH_RANGE_KEYS)[number];

export const MONTH_RANGE_LABELS: Record<MonthRangeKey, string> = {
  '12-02': 'Декабрь – Февраль',
  '03-05': 'Март – Май',
  '06-08': 'Июнь – Август',
  '09-11': 'Сентябрь – Ноябрь',
};

export interface AgentSettingsDto {
  pipeline: {
    confidenceThreshold: number;
    minTours: number;
    maxTours: number;
    tourSearchLimit: number;
    newsMaxAgeDays: number;
    newsMaxPerSource: number;
  };
  llm: {
    model?: string;
    temperature: { analyzer: number; post: number; landing: number; factcheck: number };
    maxTokens: number;
  };
  brand: {
    name: string;
    voice: BrandVoice;
    defaultAudience: BrandAudience;
    allowEmoji: boolean;
    bannedWords: string[];
    requiredHashtags: string[];
  };
  geo: {
    prioritized: string[];
    blocked: string[];
  };
  seasonalPriorities: Record<MonthRangeKey, string[]>;
  tourFilters: {
    minPriceRub: number | null;
    maxPriceRub: number | null;
    minNights: number | null;
    maxNights: number | null;
  };
}

export const DEFAULT_SETTINGS: AgentSettingsDto = {
  pipeline: {
    confidenceThreshold: 0.4,
    minTours: 3,
    maxTours: 8,
    tourSearchLimit: 40,
    newsMaxAgeDays: 21,
    newsMaxPerSource: 5,
  },
  llm: {
    temperature: { analyzer: 0.3, post: 0.6, landing: 0.5, factcheck: 0 },
    maxTokens: 3500,
  },
  brand: {
    name: 'YouTravel.me',
    voice: 'friendly',
    defaultAudience: 'mixed',
    allowEmoji: true,
    bannedWords: [],
    requiredHashtags: [],
  },
  geo: { prioritized: [], blocked: [] },
  seasonalPriorities: {
    '12-02': [],
    '03-05': [],
    '06-08': [],
    '09-11': [],
  },
  tourFilters: {
    minPriceRub: null,
    maxPriceRub: null,
    minNights: null,
    maxNights: null,
  },
};

export interface SettingsFile {
  settings: AgentSettingsDto;
  sha: string | null;
}

function mergeSettings(over: Partial<AgentSettingsDto>): AgentSettingsDto {
  return {
    pipeline: { ...DEFAULT_SETTINGS.pipeline, ...(over.pipeline ?? {}) },
    llm: {
      ...DEFAULT_SETTINGS.llm,
      ...(over.llm ?? {}),
      temperature: { ...DEFAULT_SETTINGS.llm.temperature, ...(over.llm?.temperature ?? {}) },
    },
    brand: { ...DEFAULT_SETTINGS.brand, ...(over.brand ?? {}) },
    geo: { ...DEFAULT_SETTINGS.geo, ...(over.geo ?? {}) },
    seasonalPriorities: {
      ...DEFAULT_SETTINGS.seasonalPriorities,
      ...(over.seasonalPriorities ?? {}),
    },
    tourFilters: { ...DEFAULT_SETTINGS.tourFilters, ...(over.tourFilters ?? {}) },
  };
}

export async function loadSettingsFromRepo(token: string): Promise<SettingsFile> {
  const client = createGithubClient(token);
  const file = await getFileContent(client, CONFIG.settingsPath);
  if (!file) {
    return { settings: { ...DEFAULT_SETTINGS }, sha: null };
  }
  try {
    const parsed = JSON.parse(file.content) as Partial<AgentSettingsDto>;
    return { settings: mergeSettings(parsed), sha: file.sha };
  } catch (err) {
    throw new Error(`settings.json is not valid JSON: ${(err as Error).message}`);
  }
}

export async function saveSettingsToRepo(
  token: string,
  settings: AgentSettingsDto,
  sha: string | null,
  commitMessage: string,
): Promise<void> {
  const client = createGithubClient(token);
  const json = JSON.stringify(settings, null, 2) + '\n';
  await putFileContent(client, {
    path: CONFIG.settingsPath,
    content: json,
    message: commitMessage,
    ...(sha ? { sha } : {}),
  });
}

/**
 * Atomic full-replace of settings.json — always commits against the
 * freshest sha so external commits (e.g. scheduled.yml landing) don't
 * cause "Update is not a fast forward" errors for the admin user.
 */
export async function saveSettingsAtomic(
  token: string,
  settings: AgentSettingsDto,
  commitMessage: string,
): Promise<AgentSettingsDto> {
  const client = createGithubClient(token);
  const { next } = await commitJsonAtomic<AgentSettingsDto>(
    client,
    CONFIG.settingsPath,
    (raw) => mergeSettings(JSON.parse(raw) as Partial<AgentSettingsDto>),
    () => DEFAULT_SETTINGS,
    () => ({ next: settings, message: commitMessage }),
  );
  return next;
}
