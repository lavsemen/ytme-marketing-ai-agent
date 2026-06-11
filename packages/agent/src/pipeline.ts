import { logger } from './utils/logger.js';
import { getEnv, requireAnthropicKey, type Env } from './utils/env.js';
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
import { generateLandingContent } from './modules/ai/landingContentGenerator.js';
import { loadCatalogPages } from './modules/catalog/parseCatalogCsv.js';
import { rankCollections } from './modules/catalog/collectionRanker.js';
import { generateLanding } from './modules/landing/landingGenerator.js';
import type {
  PipelineResult,
  PipelineRunResult,
  RejectedPipelineResult,
  RejectionReason,
} from './types/result.js';
import type { NewsItem } from './types/news.js';
import type { TravelInsight } from './types/insight.js';
import {
  buildEffectivePrompts,
  currentMonthBucket,
  loadPrompts,
  loadSettings,
  type AgentSettings,
} from './config/agentConfig.js';
import { DEFAULT_PROMPTS } from './modules/ai/prompts.js';
import { filterBlocked, boostInsights } from './modules/ai/insightRanker.js';
import { getDb } from './db/firestore.js';
import {
  failRun,
  persistRejection as persistRejectionToStorage,
  persistSuccess,
  startRun,
} from './modules/deploy/persist.js';
import { tryNotifySlackRejected, tryNotifySlackSuccess } from './modules/notify/slack.js';

const AGENT_VERSION = '0.1.0';

export interface PipelineOptions {
  sourceId?: string;
  llmClient?: LlmClient;
  env?: Env;
  runId?: string;
  hint?: string;
  settings?: AgentSettings;
  /** Optional trigger label that ends up in Firestore `runs/{runId}.trigger`.
   *  Defaults to "manual" when omitted. */
  trigger?: 'manual' | 'scheduled';
}

export async function loadSources(): Promise<SourcesFile> {
  const snap = await getDb().collection('config').doc('sources').get();
  const data = snap.exists ? (snap.data() as { items?: unknown }) : null;
  const items = Array.isArray(data?.items) ? data!.items : [];
  const parsed = SourcesFileSchema.safeParse(items);
  if (!parsed.success) {
    throw new Error(
      `Firestore config/sources validation failed:\n${parsed.error.message}`,
    );
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

const REJECTION_LABELS: Record<RejectionReason, string> = {
  no_news: 'Не удалось получить новости из выбранных источников',
  low_confidence: 'Инфоповод слабо связан с travel (низкая уверенность LLM)',
  unknown_country: 'LLM не смог определить страну / направление',
  blocked_country: 'Страна в чёрном списке настроек',
  no_collections: 'Не найдена подходящая подборка в каталоге',
  llm_error: 'Ошибка анализа новостей LLM',
};

function buildRejection(input: {
  reason: RejectionReason;
  details: string;
  sourceId?: string;
  runId?: string;
  hint?: string | undefined;
  settings?: AgentSettings;
  news?: NewsItem[];
  insights?: TravelInsight[];
  topInsight?: TravelInsight;
}): RejectedPipelineResult {
  const message = `${REJECTION_LABELS[input.reason]}. ${input.details}`.trim();
  const meta: RejectedPipelineResult['meta'] = {
    createdAt: new Date().toISOString(),
    agentVersion: AGENT_VERSION,
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.hint ? { hint: input.hint } : {}),
    ...(input.settings ? { settingsSnapshot: snapshotSettings(input.settings) } : {}),
  };
  const rejected: RejectedPipelineResult = {
    status: 'rejected',
    reason: input.reason,
    message,
    newsSampled: (input.news ?? []).slice(0, 10).map((n) => ({
      title: n.title,
      url: n.url,
      sourceName: n.sourceName,
    })),
    insights: input.insights ?? [],
    meta,
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    ...(input.topInsight ? { topInsight: input.topInsight } : {}),
  };
  return rejected;
}

function snapshotSettings(s: AgentSettings): NonNullable<
  PipelineResult['meta']['settingsSnapshot']
> {
  return {
    brandName: s.brand.name,
    brandVoice: s.brand.voice,
    defaultAudience: s.brand.defaultAudience,
    confidenceThreshold: s.pipeline.confidenceThreshold,
    ...(s.llm.model ? { model: s.llm.model } : {}),
  };
}

async function persistRejection(result: RejectedPipelineResult): Promise<RejectedPipelineResult> {
  const slug = await persistRejectionToStorage(result);
  logger.warn(
    { reason: result.reason, message: result.message, slug },
    'Pipeline rejected (saved to results)',
  );
  await tryNotifySlackRejected(result);
  return result;
}

export async function runPipeline(
  options: PipelineOptions = {},
): Promise<PipelineRunResult> {
  // Record run lifecycle in Firestore so the admin UI can render
  // "in_progress" rows immediately. No-op when Firestore is disabled.
  if (options.runId) {
    try {
      await startRun({
        runId: options.runId,
        source: options.sourceId,
        hint: options.hint,
        trigger: options.trigger ?? 'manual',
      });
    } catch (err) {
      logger.warn({ err }, 'startRun failed (continuing pipeline)');
    }
  }
  try {
    return await runPipelineInner(options);
  } catch (err) {
    if (options.runId) {
      try {
        await failRun({
          runId: options.runId,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      } catch (markErr) {
        logger.warn({ err: markErr }, 'failRun mark failed');
      }
    }
    throw err;
  }
}

async function runPipelineInner(
  options: PipelineOptions = {},
): Promise<PipelineRunResult> {
  const env = options.env ?? getEnv();
  const settings = options.settings ?? (await loadSettings());
  const prompts = await loadPrompts(DEFAULT_PROMPTS);

  const hint = options.hint?.trim() || undefined;
  const effective = buildEffectivePrompts(prompts, { settings, hint });

  const llm =
    options.llmClient ??
    new AnthropicClient({
      apiKey: requireAnthropicKey(env),
      model: settings.llm.model ?? env.ANTHROPIC_MODEL,
    });

  const runId = options.runId;
  const sourceId = options.sourceId;
  const baseRej = () => ({
    ...(sourceId ? { sourceId } : {}),
    ...(runId ? { runId } : {}),
    ...(hint ? { hint } : {}),
    settings,
  });

  logger.info(
    {
      sourceId: sourceId ?? 'all',
      hint: hint ?? null,
      voice: settings.brand.voice,
      bucket: currentMonthBucket(),
      blockedCountries: settings.geo.blocked,
    },
    'Pipeline started',
  );

  const allSources = await loadSources();
  const sources = pickSources(allSources, sourceId);
  logger.info({ count: sources.length }, 'Sources selected');

  const news = await fetchAllNews(sources, {
    maxAgeDays: settings.pipeline.newsMaxAgeDays,
    maxPerSource: settings.pipeline.newsMaxPerSource,
  });
  if (news.length === 0) {
    return persistRejection(
      buildRejection({
        reason: 'no_news',
        details: `Источники (${sources.map((s) => s.id).join(', ')}) не вернули ни одной новости за последние ${settings.pipeline.newsMaxAgeDays} дней.`,
        ...baseRej(),
      }),
    );
  }
  logger.info({ count: news.length }, 'News fetched');

  let rawInsights: TravelInsight[];
  try {
    rawInsights = await analyzeNews(llm, news, {
      systemPrompt: effective.newsAnalyzer,
      temperature: settings.llm.temperature.analyzer,
      maxTokens: settings.llm.maxTokens,
    });
  } catch (err) {
    return persistRejection(
      buildRejection({
        reason: 'llm_error',
        details: (err as Error).message,
        ...baseRej(),
        news,
      }),
    );
  }

  const { kept: notBlocked, dropped: blocked } = filterBlocked(
    rawInsights,
    settings.geo.blocked,
  );
  if (blocked.length > 0) {
    logger.info(
      { dropped: blocked.map((i) => i.country) },
      'Insights dropped by geo.blocked',
    );
  }
  if (notBlocked.length === 0) {
    return persistRejection(
      buildRejection({
        reason: 'blocked_country',
        details: `Все ${rawInsights.length} insight(ов) указывают на страны из чёрного списка (${settings.geo.blocked.join(', ')}).`,
        ...baseRej(),
        news,
        insights: rawInsights,
      }),
    );
  }

  const insights = boostInsights(notBlocked, {
    geo: settings.geo,
    seasonal: settings.seasonalPriorities,
    bucket: currentMonthBucket(),
  });

  const topInsight = pickTopInsight(insights);
  logger.info(
    { country: topInsight.country, confidence: topInsight.confidenceScore },
    'Top insight selected (after geo/season boost)',
  );

  if (topInsight.confidenceScore < settings.pipeline.confidenceThreshold) {
    return persistRejection(
      buildRejection({
        reason: 'low_confidence',
        details: `confidenceScore=${topInsight.confidenceScore} (<${settings.pipeline.confidenceThreshold}). Попробуйте другой источник, измените порог в настройках или дайте подсказку (hint).`,
        ...baseRej(),
        news,
        insights,
        topInsight,
      }),
    );
  }

  if (!topInsight.country || topInsight.country.toLowerCase().trim() === 'unknown') {
    return persistRejection(
      buildRejection({
        reason: 'unknown_country',
        details: `LLM вернул country="${topInsight.country}". Без направления подборку подобрать нельзя.`,
        ...baseRej(),
        news,
        insights,
        topInsight,
      }),
    );
  }

  const catalogPages = await loadCatalogPages();
  const matched = rankCollections(catalogPages, topInsight, {
    hint,
    minScore: 12,
    maxRelated: settings.pipeline.maxTours,
  });

  if (!matched.primary) {
    return persistRejection(
      buildRejection({
        reason: 'no_collections',
        details: `Не найдена подходящая страница подборки для "${topInsight.country}" (score=${matched.score}). Загрузите/обновите CSV подборок в админке.`,
        ...baseRej(),
        news,
        insights,
        topInsight,
      }),
    );
  }

  logger.info(
    {
      primary: matched.primary.title,
      primaryUrl: matched.primary.url,
      related: matched.related.length,
      score: matched.score,
      topMatches: matched.debug,
    },
    'Catalog collections ranked',
  );

  const post = await generatePost(
    llm,
    topInsight,
    { primary: matched.primary, related: matched.related },
    {
      systemPrompt: effective.postGenerator,
      temperature: settings.llm.temperature.post,
      maxTokens: settings.llm.maxTokens,
    },
  );
  logger.info('Marketing post generated');

  const sourceNews = pickNewsForInsight(news, topInsight.sourceUrl);

  try {
    const factCheck = await factCheckPost(llm, {
      news: sourceNews,
      post,
      matched: { primary: matched.primary, related: matched.related },
      systemPrompt: effective.factCheck,
      temperature: settings.llm.temperature.factcheck,
      maxTokens: 1024,
    });
    if (factCheck.violations.length > 0) {
      logger.warn({ violations: factCheck.violations }, 'Fact-check violations detected');
    }
  } catch (err) {
    logger.warn({ err }, 'Fact-check failed (continuing)');
  }

  if (settings.brand.bannedWords.length > 0) {
    const lower = post.marketingText.toLowerCase();
    const hits = settings.brand.bannedWords.filter((w) => lower.includes(w.toLowerCase()));
    if (hits.length > 0) {
      logger.warn({ bannedHit: hits }, 'Marketing post contains banned words');
    }
  }

  const landingContent = await generateLandingContent(llm, {
    insight: topInsight,
    post,
    matched: { primary: matched.primary, related: matched.related },
    systemPrompt: effective.landingContent,
    temperature: settings.llm.temperature.landing,
    maxTokens: settings.llm.maxTokens,
  });
  logger.info(
    {
      reasons: landingContent.whyNowReasons.length,
      faq: landingContent.faqItems.length,
      blog: landingContent.blogTeasers.length,
    },
    'Landing content blocks ready',
  );

  const landing = await generateLanding({
    insight: topInsight,
    post,
    news: sourceNews,
    primaryCollection: matched.primary,
    collections: matched.related,
    content: landingContent,
    baseUrl: env.LANDING_BASE_URL,
  });

  const heroImageUrl = sourceNews.imageUrl;

  const result: PipelineResult = {
    status: 'success',
    news: {
      title: sourceNews.title,
      sourceName: sourceNews.sourceName,
      sourceUrl: sourceNews.url,
      summary: sourceNews.summary ?? topInsight.shortSummary,
    },
    insight: topInsight,
    primaryCollection: matched.primary,
    collections: matched.related,
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
      ...(hint ? { hint } : {}),
      settingsSnapshot: snapshotSettings(settings),
    },
  };

  await persistSuccess(result);
  await tryNotifySlackSuccess(result);

  logger.info({ slug: landing.slug, url: landing.url }, 'Pipeline finished');
  return result;
}
