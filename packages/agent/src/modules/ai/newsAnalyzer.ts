import type { LlmClient } from './llmClient.js';
import { extractJson } from './anthropicClient.js';
import {
  TravelInsightArraySchema,
  TravelInsightSchema,
  type TravelInsight,
} from '../../types/insight.js';
import type { NewsItem } from '../../types/news.js';
import { logger } from '../../utils/logger.js';

export interface AnalyzeNewsOptions {
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

const INSIGHT_ARRAY_KEYS = [
  'insights',
  'travelInsights',
  'travel_insights',
  'results',
  'data',
  'items',
  'infopovods',
  'infopovodList',
  'infopovod_list',
] as const;

const REPORT_OBJECT_KEYS = new Set([
  'rejectedNews',
  'infopovodList',
  'infopovods',
  'infopovodCount',
  'foundCount',
  'total_found',
  'summary',
  'explanation',
  'note',
  'period',
]);

/**
 * LLMs often wrap arrays in a single-key object or return one insight object.
 * Custom admin prompts may ask for "reports" — detect and treat separately.
 */
export function coerceTravelInsightArray(parsed: unknown): unknown {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return parsed;

  const obj = parsed as Record<string, unknown>;
  for (const key of INSIGHT_ARRAY_KEYS) {
    const val = obj[key];
    if (Array.isArray(val)) return val;
  }

  const single = TravelInsightSchema.safeParse(parsed);
  if (single.success) return [single.data];

  return parsed;
}

export function isEmptyInfopovodReport(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  const looksLikeReport = [...REPORT_OBJECT_KEYS].some((k) => k in obj);
  if (!looksLikeReport) return false;

  for (const key of INSIGHT_ARRAY_KEYS) {
    const val = obj[key];
    if (Array.isArray(val) && val.length === 0) return true;
  }
  if (obj.infopovodCount === 0 || obj.foundCount === 0 || obj.total_found === 0) {
    return true;
  }
  if ('rejectedNews' in obj) {
    const list = obj.infopovodList ?? obj.infopovods ?? obj.infopovods;
    if (!list || (Array.isArray(list) && list.length === 0)) return true;
  }
  return false;
}

/** Fallback when the model returns a report instead of TravelInsight[] — pipeline rejects via low_confidence. */
export function synthesizeLowConfidenceInsight(news: NewsItem[]): TravelInsight {
  const n = news[0]!;
  return {
    title: n.title,
    sourceUrl: n.url,
    sourceName: n.sourceName,
    shortSummary: (n.summary ?? n.text ?? n.title).slice(0, 500),
    country: 'unknown',
    travelAngle: 'Нет подходящего инфоповода в ответе модели',
    confidenceScore: 0.1,
    reasonWhyRelevant: 'Модель не вернула TravelInsight[] — проверьте промпт или источник новостей',
  };
}

function parseInsightsFromLlm(raw: string, news: NewsItem[]): TravelInsight[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (err) {
    logger.error({ raw }, 'LLM returned invalid JSON for news analysis');
    throw new Error(`NewsAnalyzer: invalid JSON from LLM: ${(err as Error).message}`);
  }

  if (isEmptyInfopovodReport(parsed)) {
    logger.warn({ parsed }, 'LLM returned empty infopovod report — using low-confidence fallback');
    return [synthesizeLowConfidenceInsight(news)];
  }

  parsed = coerceTravelInsightArray(parsed);

  const result = TravelInsightArraySchema.safeParse(parsed);
  if (!result.success) {
    logger.error({ issues: result.error.issues, parsed }, 'Insight validation failed');
    throw new Error(`NewsAnalyzer: schema validation failed: ${result.error.message}`);
  }
  if (result.data.length === 0) {
    logger.warn('LLM returned empty insight array — using low-confidence fallback');
    return [synthesizeLowConfidenceInsight(news)];
  }
  return result.data;
}

async function analyzeNewsOnce(
  llm: LlmClient,
  user: string,
  news: NewsItem[],
  options: AnalyzeNewsOptions,
): Promise<TravelInsight[]> {
  const raw = await llm.complete({
    system: options.systemPrompt,
    user,
    jsonMode: true,
    maxTokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.3,
  });
  return parseInsightsFromLlm(raw, news);
}

export async function analyzeNews(
  llm: LlmClient,
  news: NewsItem[],
  options: AnalyzeNewsOptions,
): Promise<TravelInsight[]> {
  if (news.length === 0) {
    throw new Error('analyzeNews: empty news list');
  }

  const payload = news.map((n) => ({
    title: n.title,
    url: n.url,
    sourceName: n.sourceName,
    summary: n.summary ?? n.text?.slice(0, 800) ?? '',
    publishedAt: n.publishedAt,
  }));

  logger.info({ count: payload.length }, 'Analyzing news with LLM');

  const userBase = JSON.stringify(payload, null, 2);

  try {
    return await analyzeNewsOnce(llm, userBase, news, options);
  } catch (firstErr) {
    const reason = firstErr instanceof Error ? firstErr.message : String(firstErr);
    logger.warn({ reason }, 'News analysis failed — retrying with stricter format instructions');
    const retryUser =
      `${userBase}\n\n` +
      `Предыдущий ответ не прошёл валидацию (${reason}). ` +
      'Верни ТОЛЬКО JSON-массив TravelInsight. ' +
      'Не используй infopovodList, rejectedNews, summary, posts, platform, content.';
    return analyzeNewsOnce(llm, retryUser, news, options);
  }
}

export function pickTopInsight(insights: TravelInsight[]): TravelInsight {
  if (insights.length === 0) {
    throw new Error('pickTopInsight: empty insights');
  }
  return [...insights].sort((a, b) => b.confidenceScore - a.confidenceScore)[0]!;
}
