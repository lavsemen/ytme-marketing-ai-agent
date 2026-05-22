import type { LlmClient } from './llmClient.js';
import { extractJson } from './anthropicClient.js';
import { MarketingPostSchema, type MarketingPost } from '../../types/post.js';
import type { Tour } from '../../types/tour.js';
import type { TravelInsight } from '../../types/insight.js';
import type { NewsItem } from '../../types/news.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

export interface GeneratePostOptions {
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export async function generatePost(
  llm: LlmClient,
  insight: TravelInsight,
  tours: Tour[],
  options: GeneratePostOptions,
): Promise<MarketingPost> {
  if (tours.length === 0) {
    throw new Error('generatePost: empty tours list');
  }

  const payload = {
    insight,
    tours: tours.map((t) => ({
      id: t.id,
      title: t.title,
      url: t.url,
      shortDescription: t.shortDescription,
      price: t.price,
      duration: t.duration,
      country: t.country,
    })),
  };

  logger.info({ tours: tours.length, country: insight.country }, 'Generating marketing post');

  const raw = await llm.complete({
    system: options.systemPrompt,
    user: JSON.stringify(payload, null, 2),
    jsonMode: true,
    maxTokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.6,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (err) {
    logger.error({ raw }, 'LLM returned invalid JSON for post generation');
    throw new Error(`PostGenerator: invalid JSON from LLM: ${(err as Error).message}`);
  }

  const result = MarketingPostSchema.safeParse(parsed);
  if (!result.success) {
    logger.error({ issues: result.error.issues, parsed }, 'Post validation failed');
    throw new Error(`PostGenerator: schema validation failed: ${result.error.message}`);
  }

  return result.data;
}

const FactCheckResultSchema = z.object({
  violations: z.array(z.string()),
});

export interface FactCheckResult {
  violations: string[];
}

export interface FactCheckOptions {
  news: NewsItem;
  post: MarketingPost;
  tours: Tour[];
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export async function factCheckPost(
  llm: LlmClient,
  options: FactCheckOptions,
): Promise<FactCheckResult> {
  const payload = {
    sourceText: `${options.news.title}\n\n${options.news.summary ?? options.news.text ?? ''}`,
    marketingText: options.post.marketingText,
    tours: options.tours.map((t) => ({ id: t.id, title: t.title, url: t.url })),
  };

  logger.debug('Running fact-check pass');

  const raw = await llm.complete({
    system: options.systemPrompt,
    user: JSON.stringify(payload, null, 2),
    jsonMode: true,
    maxTokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (err) {
    logger.warn({ raw, err }, 'FactCheck: invalid JSON, treating as no-violations');
    return { violations: [] };
  }

  const result = FactCheckResultSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn({ issues: result.error.issues }, 'FactCheck: invalid schema, ignoring');
    return { violations: [] };
  }

  return result.data;
}
