import type { LlmClient } from './llmClient.js';
import { extractJson } from './anthropicClient.js';
import { MarketingPostSchema, type MarketingPost } from '../../types/post.js';
import type { CatalogPage, MatchedCollections } from '../../types/catalogPage.js';
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
  matched: MatchedCollections,
  options: GeneratePostOptions,
): Promise<MarketingPost> {
  const payload = {
    insight,
    primaryCollection: matched.primary,
    relatedCollections: matched.related,
  };

  logger.info(
    { primary: matched.primary.title, related: matched.related.length, country: insight.country },
    'Generating marketing post',
  );

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

  parsed = coerceMarketingPost(parsed);

  const result = MarketingPostSchema.safeParse(parsed);
  if (!result.success) {
    logger.error({ issues: result.error.issues, parsed }, 'Post validation failed');
    throw new Error(`PostGenerator: schema validation failed: ${result.error.message}`);
  }

  return {
    ...result.data,
    marketingText: enrichMarketingTextWithCollections(result.data.marketingText, matched),
  };
}

const FactCheckResultSchema = z.object({
  violations: z.array(z.string()),
});

function coerceMarketingPost(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed;
  const obj = parsed as Record<string, unknown>;
  for (const key of ['post', 'marketingPost', 'marketing_post', 'result', 'data'] as const) {
    const val = obj[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) return val;
  }
  return parsed;
}

function coerceFactCheckResult(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed;
  const obj = parsed as Record<string, unknown>;
  if (Array.isArray(obj.violations)) return parsed;
  for (const key of ['result', 'data', 'factCheck', 'fact_check'] as const) {
    const val = obj[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) return val;
  }
  return parsed;
}

export interface FactCheckResult {
  violations: string[];
}

export interface FactCheckOptions {
  news: NewsItem;
  post: MarketingPost;
  matched: MatchedCollections;
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
    primaryCollection: options.matched.primary,
    relatedCollections: options.matched.related.map((c) => ({
      title: c.title,
      url: c.url,
    })),
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

  parsed = coerceFactCheckResult(parsed);

  const result = FactCheckResultSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn({ issues: result.error.issues }, 'FactCheck: invalid schema, ignoring');
    return { violations: [] };
  }

  return result.data;
}

function collectionMentioned(text: string, page: CatalogPage): boolean {
  const lower = text.toLowerCase();
  return lower.includes(page.url.toLowerCase()) || lower.includes(page.title.toLowerCase());
}

function formatCollectionLine(page: CatalogPage): string {
  const count =
    page.tourCount !== undefined ? ` — ${page.tourCount} туров` : '';
  return `«${page.title}»${count}: ${page.url}`;
}

/** Ensures matched catalog pages appear in the post body (primary URL is mandatory). */
export function enrichMarketingTextWithCollections(
  text: string,
  matched: MatchedCollections,
): string {
  const trimmed = text.trim();
  const lines: string[] = [];

  if (!trimmed.includes(matched.primary.url)) {
    lines.push(formatCollectionLine(matched.primary));
  }

  const seen = new Set<string>([matched.primary.url]);
  for (const page of matched.related) {
    if (lines.length >= 4) break;
    if (seen.has(page.url)) continue;
    seen.add(page.url);
    if (!collectionMentioned(trimmed, page)) {
      lines.push(formatCollectionLine(page));
    }
  }

  if (lines.length === 0) return trimmed;

  return `${trimmed}\n\nПодборки YouTravel.me:\n${lines.map((line) => `• ${line}`).join('\n')}`;
}
