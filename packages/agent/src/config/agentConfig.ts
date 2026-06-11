import { z } from 'zod';
import { getDb } from '../db/firestore.js';
import {
  composeLlmSystemPrompt,
  FACT_CHECK_OUTPUT_CONTRACT,
  LANDING_CONTENT_OUTPUT_CONTRACT,
  NEWS_ANALYZER_OUTPUT_CONTRACT,
  POST_GENERATOR_OUTPUT_CONTRACT,
} from '../modules/ai/outputContracts.js';

const PromptsSchema = z.object({
  systemGuardrails: z.string().min(1),
  newsAnalyzer: z.string().min(1),
  postGenerator: z.string().min(1),
  landingContent: z.string().min(1),
  factCheck: z.string().min(1),
});

export type PromptsConfig = z.infer<typeof PromptsSchema>;

const PipelineSettingsSchema = z.object({
  confidenceThreshold: z.number().min(0).max(1),
  minTours: z.number().int().min(1),
  maxTours: z.number().int().min(1),
  tourSearchLimit: z.number().int().min(1).max(200),
  newsMaxAgeDays: z.number().int().min(1).max(365),
  newsMaxPerSource: z.number().int().min(1).max(50),
  dedupeInfopovods: z.boolean().default(true),
});

const LlmTemperaturesSchema = z.object({
  analyzer: z.number().min(0).max(2),
  post: z.number().min(0).max(2),
  landing: z.number().min(0).max(2),
  factcheck: z.number().min(0).max(2),
});

const LlmSettingsSchema = z.object({
  model: z.string().min(1).optional(),
  temperature: LlmTemperaturesSchema,
  maxTokens: z.number().int().min(256).max(8192),
});

export const BRAND_VOICES = ['friendly', 'formal', 'playful', 'luxury'] as const;
export const BRAND_AUDIENCES = ['mixed', 'family', 'solo', 'premium', 'budget'] as const;

const BrandSettingsSchema = z.object({
  name: z.string().min(1),
  voice: z.enum(BRAND_VOICES),
  defaultAudience: z.enum(BRAND_AUDIENCES),
  allowEmoji: z.boolean(),
  bannedWords: z.array(z.string().min(1)),
  requiredHashtags: z.array(z.string().min(1)),
});

const GeoSettingsSchema = z.object({
  prioritized: z.array(z.string().min(1)),
  blocked: z.array(z.string().min(1)),
});

const MONTH_RANGE_KEYS = ['12-02', '03-05', '06-08', '09-11'] as const;
export type MonthRangeKey = (typeof MONTH_RANGE_KEYS)[number];

const SeasonalPrioritiesSchema = z.object({
  '12-02': z.array(z.string().min(1)),
  '03-05': z.array(z.string().min(1)),
  '06-08': z.array(z.string().min(1)),
  '09-11': z.array(z.string().min(1)),
});

const NullableNumber = z.union([z.number().nonnegative(), z.null()]);

const TourFiltersSchema = z.object({
  minPriceRub: NullableNumber,
  maxPriceRub: NullableNumber,
  minNights: NullableNumber,
  maxNights: NullableNumber,
});

export const SettingsSchema = z.object({
  pipeline: PipelineSettingsSchema,
  llm: LlmSettingsSchema,
  brand: BrandSettingsSchema,
  geo: GeoSettingsSchema,
  seasonalPriorities: SeasonalPrioritiesSchema,
  tourFilters: TourFiltersSchema,
});

export type AgentSettings = z.infer<typeof SettingsSchema>;
export type BrandSettings = z.infer<typeof BrandSettingsSchema>;
export type GeoSettings = z.infer<typeof GeoSettingsSchema>;
export type TourFiltersSettings = z.infer<typeof TourFiltersSchema>;
export type SeasonalPrioritiesSettings = z.infer<typeof SeasonalPrioritiesSchema>;
export type LlmTemperatures = z.infer<typeof LlmTemperaturesSchema>;

export const DEFAULT_SETTINGS: AgentSettings = {
  pipeline: {
    confidenceThreshold: 0.4,
    minTours: 3,
    maxTours: 8,
    tourSearchLimit: 40,
    newsMaxAgeDays: 21,
    newsMaxPerSource: 5,
    dedupeInfopovods: true,
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

/** Deep-merge overrides into defaults (arrays are replaced wholesale). */
function deepMerge<T>(base: T, override: unknown): T {
  if (override === null || override === undefined) return base;
  if (Array.isArray(base) || typeof base !== 'object' || base === null) {
    return (override as T) ?? base;
  }
  if (typeof override !== 'object') return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    const baseValue = (base as Record<string, unknown>)[k];
    out[k] = deepMerge(baseValue as unknown, v);
  }
  return out as T;
}

export function mergeSettings(override: unknown): AgentSettings {
  const merged = deepMerge<AgentSettings>(DEFAULT_SETTINGS, override);
  return SettingsSchema.parse(merged);
}

export function mergePrompts(
  defaults: PromptsConfig,
  override: unknown,
): PromptsConfig {
  const merged = { ...defaults };
  if (override && typeof override === 'object') {
    for (const key of Object.keys(defaults) as (keyof PromptsConfig)[]) {
      const val = (override as Record<string, unknown>)[key];
      // Firestore / admin UI may store "" for fields the user never filled — keep repo defaults.
      if (typeof val === 'string' && val.trim()) {
        merged[key] = val.trim();
      }
    }
  }
  return PromptsSchema.parse(merged);
}

/** Reads `config/settings` from Firestore and merges with defaults. */
export async function loadSettings(): Promise<AgentSettings> {
  const snap = await getDb().collection('config').doc('settings').get();
  return mergeSettings(snap.exists ? snap.data() : null);
}

export async function loadPrompts(defaults: PromptsConfig): Promise<PromptsConfig> {
  const snap = await getDb().collection('config').doc('prompts').get();
  return mergePrompts(defaults, snap.exists ? snap.data() : null);
}

export async function saveSettings(settings: AgentSettings): Promise<void> {
  await getDb()
    .collection('config')
    .doc('settings')
    .set({ ...settings, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function savePrompts(prompts: PromptsConfig): Promise<void> {
  await getDb()
    .collection('config')
    .doc('prompts')
    .set({ ...prompts, updatedAt: new Date().toISOString() }, { merge: true });
}

/**
 * Cron-based schedules for the `run-scheduled` CLI command.
 * Each rule has its own cron expression and timezone; the runner picks rules
 * whose previous cron tick falls inside the current hour window.
 */
export const SCHEDULES_MAX_ENABLED = 10;

export const ScheduleRuleSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  name: z.string().min(1).max(80),
  cron: z.string().min(9).max(120),
  tz: z.string().min(1).max(80).default('Europe/Moscow'),
  source: z.string().min(1).max(80),
  hint: z.string().max(800).optional(),
  /** ISO timestamp of the cron tick last executed for this rule (dedup). */
  lastFiredPrevTick: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const SchedulesConfigSchema = z.object({
  rules: z.array(ScheduleRuleSchema),
});

export type ScheduleRule = z.infer<typeof ScheduleRuleSchema>;
export type SchedulesConfig = z.infer<typeof SchedulesConfigSchema>;

export const DEFAULT_SCHEDULES: SchedulesConfig = { rules: [] };

export function mergeSchedules(override: unknown): SchedulesConfig {
  if (!override || typeof override !== 'object') return DEFAULT_SCHEDULES;
  return SchedulesConfigSchema.parse(override);
}

export async function loadSchedules(): Promise<SchedulesConfig> {
  const snap = await getDb().collection('config').doc('schedules').get();
  return mergeSchedules(snap.exists ? snap.data() : null);
}

export async function saveSchedules(s: SchedulesConfig): Promise<void> {
  const rules = s.rules.map((r) => normalizeScheduleRuleForWrite(r));
  await getDb()
    .collection('config')
    .doc('schedules')
    .set({ rules, updatedAt: new Date().toISOString() }, { merge: true });
}

/** Marks a cron tick as executed after a successful pipeline run (dedup). */
export async function markScheduleRuleFired(ruleId: string, prevTick: Date): Promise<void> {
  const snap = await getDb().collection('config').doc('schedules').get();
  const current = mergeSchedules(snap.exists ? snap.data() : null);
  const iso = prevTick.toISOString();
  const rules = current.rules.map((r) =>
    r.id === ruleId
      ? { ...r, lastFiredPrevTick: iso, updatedAt: new Date().toISOString() }
      : r,
  );
  await saveSchedules({ rules });
}

/** Clears a premature fired marker so the same cron tick can retry (reject/error). */
export async function clearScheduleRuleFiredIfMatches(
  ruleId: string,
  prevTick: Date,
): Promise<void> {
  const iso = prevTick.toISOString();
  const snap = await getDb().collection('config').doc('schedules').get();
  const current = mergeSchedules(snap.exists ? snap.data() : null);
  const target = current.rules.find((r) => r.id === ruleId);
  if (!target || target.lastFiredPrevTick !== iso) return;
  const rules = current.rules.map((r) => {
    if (r.id !== ruleId) return r;
    const { lastFiredPrevTick: _drop, ...rest } = r;
    return { ...rest, updatedAt: new Date().toISOString() };
  });
  await saveSchedules({ rules });
}

function normalizeScheduleRuleForWrite(r: ScheduleRule): ScheduleRule {
  const base: ScheduleRule = {
    id: r.id,
    enabled: r.enabled,
    name: r.name,
    cron: r.cron,
    tz: r.tz,
    source: r.source,
  };
  const hint = r.hint?.trim();
  if (hint) base.hint = hint;
  if (r.lastFiredPrevTick) base.lastFiredPrevTick = r.lastFiredPrevTick;
  if (r.createdAt) base.createdAt = r.createdAt;
  if (r.updatedAt) base.updatedAt = r.updatedAt;
  return base;
}

/** Replaces {{path.to.key}} placeholders with values; arrays joined by ", "; missing → "". */
export function applyTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, expr: string) => {
    const value = resolvePath(vars, expr);
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

function resolvePath(obj: unknown, dottedPath: string): unknown {
  return dottedPath
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
      obj,
    );
}

/** Current month index → which seasonal bucket it belongs to. */
export function currentMonthBucket(now: Date = new Date()): MonthRangeKey {
  const m = now.getMonth() + 1; // 1..12
  if (m === 12 || m === 1 || m === 2) return '12-02';
  if (m >= 3 && m <= 5) return '03-05';
  if (m >= 6 && m <= 8) return '06-08';
  return '09-11';
}

export interface PromptContext {
  settings: AgentSettings;
  hint?: string | undefined;
  now?: Date;
}

/**
 * Build the contextual block that is appended to EVERY LLM call.
 * Contains brand voice, geo rules, seasonal priorities, banned words, and per-run hint.
 */
export function buildContextBlock(ctx: PromptContext): string {
  const { settings, hint } = ctx;
  const bucket = currentMonthBucket(ctx.now);
  const seasonalCountries = settings.seasonalPriorities[bucket];

  const parts: string[] = [];
  parts.push('===');
  parts.push('Контекст бренда (всегда учитывай):');
  parts.push(`- Бренд: ${settings.brand.name}`);
  parts.push(`- Голос: ${voiceLabel(settings.brand.voice)}`);
  parts.push(`- Целевая аудитория по умолчанию: ${audienceLabel(settings.brand.defaultAudience)}`);
  parts.push(`- Эмодзи: ${settings.brand.allowEmoji ? 'допустимы умеренно' : 'НЕ использовать'}`);

  if (settings.brand.bannedWords.length > 0) {
    parts.push(`- Запрещённые слова/формулировки (не использовать): ${settings.brand.bannedWords.join(', ')}`);
  }
  if (settings.brand.requiredHashtags.length > 0) {
    parts.push(`- Обязательные хэштеги (упомянуть в конце поста): ${settings.brand.requiredHashtags.join(' ')}`);
  }

  if (settings.geo.blocked.length > 0) {
    parts.push(
      `- ЗАПРЕЩЁННЫЕ страны (никогда не выбирать insight и не упоминать как направление): ${settings.geo.blocked.join(', ')}`,
    );
  }
  if (settings.geo.prioritized.length > 0) {
    parts.push(`- Приоритетные страны (при прочих равных выбирай их): ${settings.geo.prioritized.join(', ')}`);
  }
  if (seasonalCountries.length > 0) {
    parts.push(
      `- Сезонный приоритет (${bucket}): ${seasonalCountries.join(', ')} — учитывай в выборе и подаче.`,
    );
  }

  if (hint && hint.trim()) {
    parts.push('');
    parts.push('Дополнительные инструкции маркетолога для этой генерации (имеют высокий приоритет):');
    parts.push(hint.trim());
  }
  parts.push('===');

  return parts.join('\n');
}

const VOICE_LABELS: Record<(typeof BRAND_VOICES)[number], string> = {
  friendly: 'дружелюбный, тёплый, на «вы», без официоза',
  formal: 'сдержанный, деловой, без сленга',
  playful: 'лёгкий, игривый, можно метафоры',
  luxury: 'премиальный, лаконичный, без восклицаний',
};
function voiceLabel(v: (typeof BRAND_VOICES)[number]): string {
  return VOICE_LABELS[v];
}

const AUDIENCE_LABELS: Record<(typeof BRAND_AUDIENCES)[number], string> = {
  mixed: 'смешанная (разные сегменты)',
  family: 'семьи с детьми',
  solo: 'одиночные путешественники',
  premium: 'премиум-сегмент',
  budget: 'бюджетные путешественники',
};
function audienceLabel(a: (typeof BRAND_AUDIENCES)[number]): string {
  return AUDIENCE_LABELS[a];
}

export interface EffectivePrompts {
  newsAnalyzer: string;
  postGenerator: string;
  landingContent: string;
  factCheck: string;
}

/** Builds the final per-call system prompts: immutable output contract + editable task + context. */
export function buildEffectivePrompts(
  prompts: PromptsConfig,
  ctx: PromptContext,
): EffectivePrompts {
  const context = buildContextBlock(ctx);
  const guardrails = prompts.systemGuardrails;
  const withContract = (contract: string, instructions: string): string =>
    composeLlmSystemPrompt(contract, instructions, { guardrails, contextBlock: context });

  return {
    newsAnalyzer: withContract(NEWS_ANALYZER_OUTPUT_CONTRACT, prompts.newsAnalyzer),
    postGenerator: withContract(POST_GENERATOR_OUTPUT_CONTRACT, prompts.postGenerator),
    landingContent: withContract(LANDING_CONTENT_OUTPUT_CONTRACT, prompts.landingContent),
    factCheck: withContract(FACT_CHECK_OUTPUT_CONTRACT, prompts.factCheck),
  };
}
