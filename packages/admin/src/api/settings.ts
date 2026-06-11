import { getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { refs } from './db';

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
  /** Optional Firestore server timestamp (ISO string at read time). Never
   *  set by the UI directly — populated by setDoc with serverTimestamp(). */
  updatedAt?: string;
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
}

function normalizeStringList(items: string[]): string[] {
  return items.map((line) => line.trim()).filter((line) => line.length > 0);
}

function normalizeSettingsForSave(settings: AgentSettingsDto): AgentSettingsDto {
  return {
    ...settings,
    brand: {
      ...settings.brand,
      bannedWords: normalizeStringList(settings.brand.bannedWords),
      requiredHashtags: normalizeStringList(settings.brand.requiredHashtags),
    },
    geo: {
      prioritized: normalizeStringList(settings.geo.prioritized),
      blocked: normalizeStringList(settings.geo.blocked),
    },
    seasonalPriorities: {
      '12-02': normalizeStringList(settings.seasonalPriorities['12-02']),
      '03-05': normalizeStringList(settings.seasonalPriorities['03-05']),
      '06-08': normalizeStringList(settings.seasonalPriorities['06-08']),
      '09-11': normalizeStringList(settings.seasonalPriorities['09-11']),
    },
  };
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

export async function loadSettings(): Promise<SettingsFile> {
  const snap = await getDoc(refs.settings());
  if (!snap.exists()) return { settings: { ...DEFAULT_SETTINGS } };
  return { settings: mergeSettings(snap.data() as Partial<AgentSettingsDto>) };
}

/** Full-replace of config/settings. Firestore is the source of truth. */
export async function saveSettings(settings: AgentSettingsDto): Promise<AgentSettingsDto> {
  const normalized = normalizeSettingsForSave(settings);
  await setDoc(refs.settings(), {
    ...normalized,
    updatedAt: serverTimestamp() as unknown as string,
  });
  return normalized;
}
