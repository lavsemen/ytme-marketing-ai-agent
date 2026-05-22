import type { Octokit } from '@octokit/rest';
import { CONFIG } from '../lib/config';
import { createGithubClient, getFileContent, putFileContent } from './github';
import defaultPromptsJson from '../data/default-prompts.json';

export interface PromptsDto {
  systemGuardrails: string;
  newsAnalyzer: string;
  postGenerator: string;
  landingContent: string;
  factCheck: string;
}

export const DEFAULT_PROMPTS: PromptsDto = defaultPromptsJson as PromptsDto;

export type PromptKey = keyof PromptsDto;

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
  systemGuardrails: 'Общие правила тона и фактчека. Этот текст НЕ приклеивается отдельно — мы используем его только как маркер дефолта (промпты сами по себе содержат guardrails).',
  newsAnalyzer: 'Промпт первого LLM-вызова: на вход — массив новостей, на выход — массив TravelInsight.',
  postGenerator: 'Промпт второго LLM-вызова: на вход insight + tours, на выход MarketingPost.',
  landingContent: 'Промпт третьего LLM-вызова: на вход — insight + post + tours, на выход — блочный контент лендинга.',
  factCheck: 'Промпт фактчек-вызова: проверяет, не выдумал ли пост фактов.',
};

export interface PromptsFile {
  prompts: PromptsDto;
  sha: string | null;
}

export async function loadPromptsFromRepo(token: string): Promise<PromptsFile> {
  const client = createGithubClient(token);
  return loadPromptsWithClient(client);
}

async function loadPromptsWithClient(client: Octokit): Promise<PromptsFile> {
  const file = await getFileContent(client, CONFIG.promptsPath);
  if (!file) {
    return {
      prompts: emptyPrompts(),
      sha: null,
    };
  }
  try {
    const parsed = JSON.parse(file.content) as PromptsDto;
    return { prompts: { ...emptyPrompts(), ...parsed }, sha: file.sha };
  } catch (err) {
    throw new Error(`prompts.json is not valid JSON: ${(err as Error).message}`);
  }
}

export async function savePromptsToRepo(
  token: string,
  prompts: PromptsDto,
  sha: string | null,
  commitMessage: string,
): Promise<void> {
  const client = createGithubClient(token);
  const json = JSON.stringify(prompts, null, 2) + '\n';
  await putFileContent(client, {
    path: CONFIG.promptsPath,
    content: json,
    message: commitMessage,
    ...(sha ? { sha } : {}),
  });
}

function emptyPrompts(): PromptsDto {
  return {
    systemGuardrails: '',
    newsAnalyzer: '',
    postGenerator: '',
    landingContent: '',
    factCheck: '',
  };
}
