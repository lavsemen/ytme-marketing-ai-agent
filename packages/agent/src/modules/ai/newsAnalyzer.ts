import type { LlmClient } from './llmClient.js';
import { NEWS_ANALYZER_PROMPT } from './prompts.js';
import { extractJson } from './anthropicClient.js';
import {
  TravelInsightArraySchema,
  type TravelInsight,
} from '../../types/insight.js';
import type { NewsItem } from '../../types/news.js';
import { logger } from '../../utils/logger.js';

export async function analyzeNews(
  llm: LlmClient,
  news: NewsItem[],
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

  const raw = await llm.complete({
    system: NEWS_ANALYZER_PROMPT,
    user: JSON.stringify(payload, null, 2),
    jsonMode: true,
    maxTokens: 2048,
    temperature: 0.3,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (err) {
    logger.error({ raw }, 'LLM returned invalid JSON for news analysis');
    throw new Error(`NewsAnalyzer: invalid JSON from LLM: ${(err as Error).message}`);
  }

  const result = TravelInsightArraySchema.safeParse(parsed);
  if (!result.success) {
    logger.error({ issues: result.error.issues, parsed }, 'Insight validation failed');
    throw new Error(`NewsAnalyzer: schema validation failed: ${result.error.message}`);
  }

  return result.data;
}

export function pickTopInsight(insights: TravelInsight[]): TravelInsight {
  if (insights.length === 0) {
    throw new Error('pickTopInsight: empty insights');
  }
  return [...insights].sort((a, b) => b.confidenceScore - a.confidenceScore)[0]!;
}
