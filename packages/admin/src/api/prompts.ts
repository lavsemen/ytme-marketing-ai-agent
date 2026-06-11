import { getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { refs } from './db';
import defaultPromptsJson from '../data/default-prompts.json';

export interface PromptsDto {
  systemGuardrails: string;
  newsAnalyzer: string;
  postGenerator: string;
  landingContent: string;
  factCheck: string;
  /** Optional Firestore server timestamp (ISO string at read time). Never
   *  set by the UI directly — populated by setDoc with serverTimestamp(). */
  updatedAt?: string;
}

export const DEFAULT_PROMPTS: PromptsDto = defaultPromptsJson as PromptsDto;

export type PromptKey = Exclude<keyof PromptsDto, 'updatedAt'>;

export const PROMPT_KEYS: PromptKey[] = [
  'systemGuardrails',
  'newsAnalyzer',
  'postGenerator',
  'landingContent',
  'factCheck',
];

export const PROMPT_LABELS: Record<PromptKey, string> = {
  systemGuardrails: 'Системные правила (Guardrails)',
  newsAnalyzer: 'Анализ новостей',
  postGenerator: 'Генератор маркетингового поста',
  landingContent: 'Контент лендинга',
  factCheck: 'Фактчекинг',
};

export const PROMPT_HINTS: Record<PromptKey, string> = {
  systemGuardrails: 'Общие ограничения (факты, язык). Формат JSON задаётся кодом автоматически.',
  newsAnalyzer: 'Критерии отбора travel-инфоповодов. Формат ответа (массив TravelInsight) — фиксирован в коде.',
  postGenerator: 'Тон и содержание поста. Структура MarketingPost — фиксирована в коде.',
  landingContent: 'Акценты блоков лендинга. Схема LandingContent — фиксирована в коде.',
  factCheck: 'Что считать нарушением. Ответ всегда { violations: string[] }.',
};

export interface PromptsFile {
  prompts: PromptsDto;
}

export async function loadPrompts(): Promise<PromptsFile> {
  const snap = await getDoc(refs.prompts());
  if (!snap.exists()) {
    return { prompts: { ...DEFAULT_PROMPTS } };
  }
  return { prompts: normalizePrompts(snap.data() as Partial<PromptsDto>) };
}

/** Full-replace of config/prompts. Firestore is the source of truth. */
export async function savePrompts(prompts: PromptsDto): Promise<PromptsDto> {
  const normalized = normalizePrompts(prompts);
  await setDoc(refs.prompts(), {
    ...normalized,
    updatedAt: serverTimestamp() as unknown as string,
  });
  return normalized;
}

function normalizePrompts(raw: Partial<PromptsDto>): PromptsDto {
  const out = { ...DEFAULT_PROMPTS };
  for (const key of PROMPT_KEYS) {
    const val = raw[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      out[key] = val;
    }
  }
  return out;
}
