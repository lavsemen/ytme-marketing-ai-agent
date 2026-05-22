import path from 'node:path';
import { LANDINGS_DIR, REPO_ROOT, writeFile, pathExists } from '../../utils/fs.js';
import { generateSlug, uniqueSlug } from './slug.js';
import {
  buildIndexHtml,
  buildScriptJs,
  buildStylesCss,
  type LandingTemplateContext,
} from './templates.js';
import { ensurePlaceholderAsset } from './assets.js';
import type { LandingInfo } from '../../types/landing.js';
import type { Tour } from '../../types/tour.js';
import type { TravelInsight } from '../../types/insight.js';
import type { MarketingPost } from '../../types/post.js';
import type { NewsItem } from '../../types/news.js';
import { logger } from '../../utils/logger.js';
import { promises as fs } from 'node:fs';

export interface GenerateLandingInput {
  insight: TravelInsight;
  post: MarketingPost;
  news: NewsItem;
  tours: Tour[];
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
    ...(pickHeroImage(input) ? { heroImageUrl: pickHeroImage(input)! } : {}),
  };

  const html = buildIndexHtml(ctx);
  const css = buildStylesCss();
  const js = buildScriptJs();

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
