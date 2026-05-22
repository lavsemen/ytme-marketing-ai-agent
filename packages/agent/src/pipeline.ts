import path from 'node:path';
import { promises as fs } from 'node:fs';
import { logger } from './utils/logger.js';
import { getEnv, requireAnthropicKey, type Env } from './utils/env.js';
import { AGENT_ROOT } from './utils/fs.js';
import {
  SourcesFileSchema,
  type Source,
  type SourcesFile,
} from './config/sources.schema.js';
import { fetchAllNews } from './modules/news/newsFetcher.js';
import type { LlmClient } from './modules/ai/llmClient.js';
import { AnthropicClient } from './modules/ai/anthropicClient.js';
import { analyzeNews, pickTopInsight } from './modules/ai/newsAnalyzer.js';
import { generatePost, factCheckPost } from './modules/ai/postGenerator.js';
import { createTourClient } from './modules/tours/index.js';
import { sanitizeGeoFilter } from './modules/tours/youtravelClient.js';
import { rankTours } from './modules/tours/tourRanker.js';
import { generateLanding } from './modules/landing/landingGenerator.js';
import { saveResult, updateIndex } from './modules/deploy/manifest.js';
import type { PipelineResult } from './types/result.js';
import type { NewsItem } from './types/news.js';

const AGENT_VERSION = '0.1.0';
const SOURCES_PATH = path.join(AGENT_ROOT, 'src', 'config', 'sources.json');

export interface PipelineOptions {
  sourceId?: string;
  llmClient?: LlmClient;
  env?: Env;
  runId?: string;
}

export async function loadSources(): Promise<SourcesFile> {
  const raw = await fs.readFile(SOURCES_PATH, 'utf8');
  const parsed = SourcesFileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`sources.json validation failed:\n${parsed.error.message}`);
  }
  return parsed.data;
}

function pickSources(all: SourcesFile, sourceId?: string): Source[] {
  if (!sourceId || sourceId === 'all') return all;
  const found = all.filter((s) => s.id === sourceId);
  if (found.length === 0) {
    throw new Error(`Source with id "${sourceId}" not found in sources.json`);
  }
  return found;
}

function pickNewsForInsight(news: NewsItem[], insightUrl: string): NewsItem {
  const found = news.find((n) => n.url === insightUrl);
  if (found) return found;
  if (news.length === 0) throw new Error('pickNewsForInsight: empty news list');
  return news[0]!;
}

export async function runPipeline(options: PipelineOptions = {}): Promise<PipelineResult> {
  const env = options.env ?? getEnv();
  const llm =
    options.llmClient ??
    new AnthropicClient({
      apiKey: requireAnthropicKey(env),
      model: env.ANTHROPIC_MODEL,
    });

  logger.info({ sourceId: options.sourceId ?? 'all' }, 'Pipeline started');

  const allSources = await loadSources();
  const sources = pickSources(allSources, options.sourceId);
  logger.info({ count: sources.length }, 'Sources selected');

  const news = await fetchAllNews(sources, { maxAgeDays: 21, maxPerSource: 5 });
  if (news.length === 0) {
    throw new Error('Pipeline: no news fetched from enabled sources');
  }
  logger.info({ count: news.length }, 'News fetched');

  const insights = await analyzeNews(llm, news);
  const topInsight = pickTopInsight(insights);
  logger.info(
    { country: topInsight.country, confidence: topInsight.confidenceScore },
    'Top insight selected',
  );

  if (topInsight.confidenceScore < 0.4) {
    throw new Error(
      `Pipeline: top insight has confidenceScore=${topInsight.confidenceScore} (<0.4). Aborting to avoid weak post.`,
    );
  }

  const tourClient = createTourClient(env);
  const tourSearch: { country?: string; region?: string; city?: string; limit: number } = {
    limit: 40,
  };
  const country = sanitizeGeoFilter(topInsight.country);
  const region = sanitizeGeoFilter(topInsight.region);
  const city = sanitizeGeoFilter(topInsight.city);
  if (country) tourSearch.country = country;
  if (region) tourSearch.region = region;
  if (city) tourSearch.city = city;

  const rawTours = await tourClient.search(tourSearch);
  logger.info({ count: rawTours.length }, 'Tours fetched');

  const tours = rankTours(rawTours, topInsight, { minCount: 3, maxCount: 8 });
  if (tours.length < 3) {
    throw new Error(
      `Pipeline: only ${tours.length} tours after ranking (need at least 3). Country="${topInsight.country}"`,
    );
  }
  logger.info({ count: tours.length }, 'Tours ranked');

  const post = await generatePost(llm, topInsight, tours);
  logger.info('Marketing post generated');

  const sourceNews = pickNewsForInsight(news, topInsight.sourceUrl);

  try {
    const factCheck = await factCheckPost(llm, { news: sourceNews, post, tours });
    if (factCheck.violations.length > 0) {
      logger.warn({ violations: factCheck.violations }, 'Fact-check violations detected');
    }
  } catch (err) {
    logger.warn({ err }, 'Fact-check failed (continuing)');
  }

  const landing = await generateLanding({
    insight: topInsight,
    post,
    news: sourceNews,
    tours,
    baseUrl: env.LANDING_BASE_URL,
  });

  const heroImageUrl =
    sourceNews.imageUrl ?? tours.find((t) => t.imageUrl)?.imageUrl;

  const result: PipelineResult = {
    news: {
      title: sourceNews.title,
      sourceName: sourceNews.sourceName,
      sourceUrl: sourceNews.url,
      summary: sourceNews.summary ?? topInsight.shortSummary,
    },
    insight: topInsight,
    tours,
    post: {
      marketingTitle: post.marketingTitle,
      marketingText: post.marketingText,
      landingUrl: landing.url,
      ...(heroImageUrl ? { imageUrl: heroImageUrl } : {}),
      ...(post.imagePrompt ? { imagePrompt: post.imagePrompt } : {}),
    },
    landing,
    meta: {
      createdAt: new Date().toISOString(),
      agentVersion: AGENT_VERSION,
      ...(options.runId ? { runId: options.runId } : {}),
    },
  };

  await saveResult(result);
  await updateIndex(result);

  logger.info({ slug: landing.slug, url: landing.url }, 'Pipeline finished');
  return result;
}
