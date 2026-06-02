import path from 'node:path';
import { LANDINGS_DIR, REPO_ROOT, writeFile, pathExists, ensureDir } from '../../utils/fs.js';
import { generateSlug, uniqueSlug } from './slug.js';
import {
  buildIndexHtml,
  buildScriptJs,
  buildStylesCss,
  type LandingTemplateContext,
  type MetricsConfig,
} from './templates.js';
import { getEnv } from '../../utils/env.js';
import { ensurePlaceholderAsset } from './assets.js';
import { ensureSharedAssets } from './shared.js';
import type { LandingInfo } from '../../types/landing.js';
import type { Tour } from '../../types/tour.js';
import type { TravelInsight } from '../../types/insight.js';
import type { MarketingPost } from '../../types/post.js';
import type { NewsItem } from '../../types/news.js';
import type { LandingContent } from '../../types/landingContent.js';
import { logger } from '../../utils/logger.js';
import { promises as fs } from 'node:fs';

export interface GenerateLandingInput {
  insight: TravelInsight;
  post: MarketingPost;
  news: NewsItem;
  tours: Tour[];
  content: LandingContent;
  baseUrl: string;
}

async function listExistingSlugs(): Promise<Set<string>> {
  try {
    const entries = await fs.readdir(LANDINGS_DIR, { withFileTypes: true });
    return new Set(
      entries
        .filter((e) => e.isDirectory() && e.name !== '_shared')
        .map((e) => e.name),
    );
  } catch {
    return new Set();
  }
}

function pickHeroImage(input: GenerateLandingInput): string | undefined {
  if (input.news.imageUrl) return input.news.imageUrl;
  const firstTour = input.tours.find((t) => t.imageUrl);
  return firstTour?.imageUrl;
}

export async function generateLanding(
  input: GenerateLandingInput,
): Promise<LandingInfo> {
  await ensureDir(LANDINGS_DIR);
  await ensureSharedAssets();
  await ensurePlaceholderAsset();

  const baseSlug = generateSlug(input.insight.title, { maxLength: 80 });
  const existing = await listExistingSlugs();
  const slug = uniqueSlug(baseSlug, existing);

  const landingDir = path.join(LANDINGS_DIR, slug);
  const url = `${input.baseUrl.replace(/\/+$/, '')}/landings/${slug}/`;

  const ctx: LandingTemplateContext = {
    slug,
    url,
    post: input.post,
    insight: input.insight,
    news: input.news,
    tours: input.tours,
    content: input.content,
    ...(pickHeroImage(input) ? { heroImageUrl: pickHeroImage(input)! } : {}),
  };

  const html = buildIndexHtml(ctx);
  const css = buildStylesCss();
  const js = buildScriptJs(buildMetricsConfig(slug));

  await writeFile(path.join(landingDir, 'index.html'), html);
  await writeFile(path.join(landingDir, 'styles.css'), css);
  await writeFile(path.join(landingDir, 'script.js'), js);

  const relativePath = path.relative(REPO_ROOT, path.join(landingDir, 'index.html'));
  logger.info({ slug, url, path: relativePath }, 'Landing generated');

  return {
    slug,
    path: `/${relativePath.split(path.sep).join('/')}`,
    url,
  };
}

export async function landingExists(slug: string): Promise<boolean> {
  return pathExists(path.join(LANDINGS_DIR, slug, 'index.html'));
}

/**
 * Builds the metrics tracker config from env. Returns `undefined` when any
 * required key is missing, so the landing script silently skips tracking
 * for repos that haven't configured Firestore yet.
 */
function buildMetricsConfig(slug: string): MetricsConfig | undefined {
  let env;
  try {
    env = getEnv();
  } catch {
    return undefined;
  }
  const { FIREBASE_PROJECT_ID, FIREBASE_WEB_API_KEY, FIREBASE_WEB_AUTH_DOMAIN, FIREBASE_WEB_APP_ID } = env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_WEB_API_KEY || !FIREBASE_WEB_APP_ID) return undefined;
  return {
    projectId: FIREBASE_PROJECT_ID,
    apiKey: FIREBASE_WEB_API_KEY,
    authDomain: FIREBASE_WEB_AUTH_DOMAIN ?? `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
    appId: FIREBASE_WEB_APP_ID,
    slug,
  };
}
