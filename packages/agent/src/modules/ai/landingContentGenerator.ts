import type { LlmClient } from './llmClient.js';
import { extractJson } from './anthropicClient.js';
import {
  LandingContentSchema,
  type BlogTeaser,
  type FaqItem,
  type HeroStat,
  type LandingContent,
  type ReasonCard,
  type WhyAuthorCard,
} from '../../types/landingContent.js';
import type { TravelInsight } from '../../types/insight.js';
import type { MarketingPost } from '../../types/post.js';
import type { MatchedCollections } from '../../types/catalogPage.js';
import { logger } from '../../utils/logger.js';

export interface GenerateLandingContentInput {
  insight: TravelInsight;
  post: MarketingPost;
  matched: MatchedCollections;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

const REASON_ACCENTS = ['#8600EF', '#1A5A3A', '#C43A2A', '#DE8706'];
const BLOG_TAG_PALETTE: Record<string, { color: string; bg: string }> = {
  'Лайфхаки': { color: '#8600EF', bg: '#F4ECFA' },
  'Страны':   { color: '#7FA40C', bg: '#F2F7E5' },
  'Маршруты': { color: '#DE8706', bg: '#FFF4E0' },
  'Кухня':    { color: '#F84565', bg: '#FEE7EC' },
};

/**
 * Trim string and hard-cap its length under `max` characters.
 * Appends an ellipsis if truncation happened.
 * Safe for empty/falsy input — returns empty string (caller decides on default).
 */
function clamp(input: string | null | undefined, max: number): string {
  if (!input) return '';
  const trimmed = String(input).trim();
  if (trimmed.length <= max) return trimmed;
  if (max <= 1) return trimmed.slice(0, max);
  return trimmed.slice(0, max - 1).trimEnd() + '…';
}

function nonEmpty(value: string, fallback: string): string {
  const v = value.trim();
  return v.length > 0 ? v : fallback;
}

function decorateContent(content: LandingContent): LandingContent {
  const reasons = content.whyNowReasons.map((r, i) => ({
    ...r,
    accent: r.accent ?? REASON_ACCENTS[i % REASON_ACCENTS.length],
  }));

  const blog = content.blogTeasers.map((b) => {
    const palette = BLOG_TAG_PALETTE[b.tag] ?? BLOG_TAG_PALETTE['Лайфхаки']!;
    return {
      ...b,
      tagColor: b.tagColor ?? palette.color,
      tagBg: b.tagBg ?? palette.bg,
    };
  });

  return { ...content, whyNowReasons: reasons, blogTeasers: blog };
}

/**
 * Last-resort safe defaults that don't reference insight data.
 * Used only if even the insight-aware fallback fails validation.
 */
function buildSafeDefaultContent(): LandingContent {
  return decorateContent(
    LandingContentSchema.parse({
      heroEyebrow: 'Авторские туры',
      heroSubtitle: 'Готовые путешествия со смыслом — выберите дату и формат.',
      heroStats: [
        { label: 'Готовые путешествия со смыслом' },
        { label: 'Авторский маршрут' },
        { label: '4.9★ рейтинг туров' },
      ],
      whyNowTitle: 'Почему стоит ехать сейчас',
      whyNowReasons: [
        { title: 'Подходящий момент', body: 'Сейчас удачное время для поездки — оцените сами.' },
        { title: 'Готовая программа', body: 'Тревел-эксперт собрал маршрут: вам остаётся выбрать дату.' },
        { title: 'Меньше хлопот', body: 'Не нужно самостоятельно собирать перелёты, ночёвки и активности.' },
        { title: 'Атмосфера группы', body: 'Едете в небольшой компании единомышленников, а не в одиночку.' },
      ],
      collectionTitle: 'Готовая подборка туров',
      collectionDesc:
        'Откройте полный каталог направления — все актуальные туры с фильтрами по датам, цене и формату.',
      toursTitle: 'Туры с тревел-экспертом',
      toursLead:
        'Каждый тур — авторский маршрут с тревел-экспертом. Выберите формат, который подходит вам.',
      howToGetTitle: 'Как добраться',
      howToGetDesc:
        'Проверьте удобные рейсы и стоимость билетов на ваши даты, чтобы заранее оценить полный бюджет поездки.',
      esimDesc:
        'Купите eSIM заранее, чтобы сразу после прилёта пользоваться картами, мессенджерами, переводчиком и такси.',
      blogTeasers: [
        { title: 'Что нужно знать перед поездкой', desc: 'Виза, документы и базовая подготовка.', tag: 'Лайфхаки' },
        { title: 'Местная кухня', desc: 'Что попробовать и где искать лучшие места.', tag: 'Кухня' },
        { title: 'Когда лучше ехать', desc: 'Сезоны, погода и важные нюансы по месяцам.', tag: 'Страны' },
        { title: 'Маршруты по направлению', desc: 'Идеи, как построить программу под себя.', tag: 'Маршруты' },
      ],
      forWhomTitle: 'Эти туры подойдут, если вы:',
      forWhomItems: [
        'Хотите увидеть страну глубже, чем в обычной поездке',
        'Не хотите самостоятельно собирать маршрут',
        'Хотите путешествовать с тревел-экспертом',
        'Едете один/одна или хотите быть в группе',
        'Любите насыщенные маршруты с чёткой программой',
        'Хотите заранее понимать бюджет и формат',
      ],
      whyAuthorCards: [
        { title: 'Маршрут уже собран', body: 'Не нужно вручную собирать локации, переезды и ночёвки — всё готово.' },
        { title: 'Тревел-эксперт рядом', body: 'Человек, который знает направление изнутри и решает вопросы на месте.' },
        { title: 'Понятная программа', body: 'Вы заранее видите, что будет каждый день и что включено в стоимость.' },
        { title: 'Можно ехать одному', body: 'В авторских турах часто едут соло — на месте группа единомышленников.' },
        { title: 'Понятный бюджет', body: 'Тур, авиабилеты и связь собраны на одной странице.' },
      ],
      faqItems: [
        { q: 'Нужна ли виза?', a: 'Проверьте актуальные требования на сайте посольства перед бронированием.' },
        { q: 'Авиабилеты входят в стоимость тура?', a: 'Обычно авиабилеты оплачиваются отдельно. На странице есть кнопка проверки билетов.' },
        { q: 'Зачем покупать eSIM заранее?', a: 'Чтобы сразу после прилёта быть на связи: карты, мессенджеры, такси, переводчик.' },
        { q: 'Как понять, какой тур выбрать?', a: 'Смотрите даты, длительность, цену, уровень активности и формат. Можно открыть общую подборку.' },
        { q: 'Можно ли поехать одному?', a: 'Да, в авторские туры часто едут соло. На месте вы путешествуете в группе единомышленников.' },
        { q: 'Что если ни один тур не подходит?', a: 'Вы можете сделать запрос на индивидуальный тур — оставьте заявку на YouTravel.me.' },
      ],
      finalCtaHeadline: 'Авторские туры с YouTravel.me',
      finalCtaSub:
        'Посмотрите туры, откройте подборку по направлению, проверьте авиабилеты и заранее подключите eSIM.',
    }),
  );
}

/**
 * Insight-aware fallback. All dynamic strings are clamped under their schema
 * limits, so this function is guaranteed to produce valid LandingContent.
 */
export function buildFallbackContent(input: GenerateLandingContentInput): LandingContent {
  const country = nonEmpty(clamp(input.insight.country, 40), 'выбранную страну');
  const angle = nonEmpty(clamp(input.insight.travelAngle, 40), 'авторские туры');
  const summary280 = nonEmpty(
    clamp(input.insight.shortSummary, 280),
    'Сейчас удачное время для поездки — оцените сами.',
  );
  const summary320 = nonEmpty(
    clamp(input.insight.shortSummary, 320),
    'Готовые путешествия со смыслом — выберите дату и формат.',
  );

  const candidate = {
    heroEyebrow: clamp(`Авторские туры · ${country}`, 60),
    heroSubtitle: summary320,
    heroStats: [
      { label: 'Готовые путешествия со смыслом' },
      { label: 'Авторский маршрут' },
      { label: '4.9★ рейтинг туров' },
    ],
    whyNowTitle: clamp(`${country}: почему сейчас`, 120),
    whyNowReasons: [
      { title: 'Подходящий момент', body: summary280 },
      { title: 'Готовая программа', body: 'Тревел-эксперт собрал маршрут: вам остаётся выбрать дату.' },
      { title: 'Меньше хлопот', body: 'Не нужно самостоятельно собирать перелёты, ночёвки и активности.' },
      { title: 'Атмосфера группы', body: 'Едете в небольшой компании единомышленников, а не в одиночку.' },
    ],
    collectionTitle: clamp(
      input.matched.primary.title || `Готовая подборка туров в ${country}`,
      120,
    ),
    collectionDesc:
      input.matched.primary.purpose ||
      'Откройте полный каталог направления — все актуальные туры с фильтрами по датам, цене и формату.',
    toursTitle: clamp(`Подборки: ${country}`, 120),
    toursLead: 'Страницы каталога YouTravel.me с турами по направлению и тематике.',
    howToGetTitle: clamp(`Как добраться до ${country}`, 120),
    howToGetDesc:
      'Проверьте удобные рейсы и стоимость билетов на ваши даты, чтобы заранее оценить полный бюджет поездки.',
    esimDesc:
      'Купите eSIM заранее, чтобы сразу после прилёта пользоваться картами, мессенджерами, переводчиком и такси.',
    blogTeasers: [
      { title: clamp(`Что нужно знать перед поездкой в ${country}`, 120), desc: 'Виза, документы и базовая подготовка.', tag: 'Лайфхаки' },
      { title: clamp(`Кухня ${country}`, 120), desc: 'Что попробовать и где искать лучшие места.', tag: 'Кухня' },
      { title: clamp(`Когда лучше ехать в ${country}`, 120), desc: 'Сезоны, погода и важные нюансы по месяцам.', tag: 'Страны' },
      { title: clamp(`Маршруты по ${country}`, 120), desc: 'Идеи, как построить программу под себя.', tag: 'Маршруты' },
    ],
    forWhomTitle: 'Эти туры подойдут, если вы:',
    forWhomItems: [
      clamp(`Хотите увидеть ${country} глубже, чем в обычной поездке`, 200),
      'Не хотите самостоятельно собирать маршрут',
      'Хотите путешествовать с тревел-экспертом',
      'Едете один/одна или хотите быть в группе',
      'Любите насыщенные маршруты с чёткой программой',
      'Хотите заранее понимать бюджет и формат',
    ],
    whyAuthorCards: [
      { title: 'Маршрут уже собран', body: 'Не нужно вручную собирать локации, переезды и ночёвки — всё готово.' },
      { title: 'Тревел-эксперт рядом', body: clamp(`Человек, который знает ${country} изнутри и решает вопросы на месте.`, 220) },
      { title: 'Понятная программа', body: 'Вы заранее видите, что будет каждый день и что включено в стоимость.' },
      { title: 'Можно ехать одному', body: 'В авторских турах часто едут соло — на месте группа единомышленников.' },
      { title: 'Понятный бюджет', body: 'Тур, авиабилеты и связь собраны на одной странице.' },
    ],
    faqItems: [
      { q: clamp(`Нужна ли виза в ${country}?`, 200), a: 'Проверьте актуальные требования на сайте посольства перед бронированием.' },
      { q: 'Авиабилеты входят в стоимость тура?', a: 'Обычно авиабилеты оплачиваются отдельно. На странице есть кнопка проверки билетов.' },
      { q: 'Зачем покупать eSIM заранее?', a: 'Чтобы сразу после прилёта быть на связи: карты, мессенджеры, такси, переводчик.' },
      { q: 'Как понять, какой тур выбрать?', a: 'Смотрите даты, длительность, цену, уровень активности и формат. Можно открыть общую подборку.' },
      { q: 'Можно ли поехать одному?', a: 'Да, в авторские туры часто едут соло. На месте вы путешествуете в группе единомышленников.' },
      { q: 'Что если ни один тур не подходит?', a: 'Вы можете сделать запрос на индивидуальный тур — оставьте заявку на YouTravel.me.' },
    ],
    finalCtaHeadline: clamp(`${angle} с YouTravel.me`, 180),
    finalCtaSub:
      'Посмотрите туры, откройте подборку по направлению, проверьте авиабилеты и заранее подключите eSIM.',
  };

  const parsed = LandingContentSchema.safeParse(candidate);
  if (parsed.success) {
    return decorateContent(parsed.data);
  }

  logger.error(
    { issues: parsed.error.issues.slice(0, 5) },
    'Insight-aware fallback failed validation — using safe-default',
  );
  return buildSafeDefaultContent();
}

/**
 * Single-string fields with their max length from LandingContentSchema.
 * Kept in sync with the schema manually — there is no public API on Zod
 * to introspect string limits reliably across versions.
 */
const SINGLE_STRING_LIMITS: Array<[keyof LandingContent, number]> = [
  ['heroEyebrow', 60],
  ['heroSubtitle', 320],
  ['whyNowEyebrow', 40],
  ['whyNowTitle', 120],
  ['collectionEyebrow', 40],
  ['collectionTitle', 120],
  ['collectionDesc', 320],
  ['toursEyebrow', 40],
  ['toursTitle', 120],
  ['toursLead', 320],
  ['howToGetEyebrow', 40],
  ['howToGetTitle', 120],
  ['howToGetDesc', 400],
  ['esimEyebrow', 40],
  ['esimTitle', 120],
  ['esimDesc', 400],
  ['blogEyebrow', 40],
  ['blogTitle', 120],
  ['forWhomEyebrow', 40],
  ['forWhomTitle', 120],
  ['whyAuthorEyebrow', 40],
  ['whyAuthorTitle', 120],
  ['faqEyebrow', 40],
  ['faqTitle', 120],
  ['finalCtaHeadline', 180],
  ['finalCtaSub', 320],
];

function clampStringField(obj: Record<string, unknown>, key: string, max: number): void {
  const v = obj[key];
  if (typeof v === 'string') obj[key] = clamp(v, max);
}

function clampArrayOfStrings(arr: unknown, max: number): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item === 'string') {
      const s = clamp(item, max);
      if (s.length > 0) out.push(s);
    }
  }
  return out;
}

function clampHeroStat(item: unknown): HeroStat | null {
  if (!item || typeof item !== 'object') return null;
  const label = clamp((item as Record<string, unknown>).label as string | undefined, 80);
  return label ? { label } : null;
}

function clampReasonCard(item: unknown): ReasonCard | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const title = clamp(o.title as string | undefined, 80);
  const body = clamp(o.body as string | undefined, 280);
  if (!title || !body) return null;
  const result: ReasonCard = { title, body };
  if (typeof o.accent === 'string' && o.accent.length > 0) result.accent = o.accent;
  return result;
}

function clampBlogTeaser(item: unknown): BlogTeaser | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const title = clamp(o.title as string | undefined, 120);
  const desc = clamp(o.desc as string | undefined, 280);
  const tag = clamp(o.tag as string | undefined, 40);
  if (!title || !desc || !tag) return null;
  const result: BlogTeaser = { title, desc, tag };
  for (const k of ['tagColor', 'tagBg', 'url'] as const) {
    const v = o[k];
    if (typeof v === 'string' && v.length > 0) result[k] = v;
  }
  return result;
}

function clampWhyAuthorCard(item: unknown): WhyAuthorCard | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const title = clamp(o.title as string | undefined, 60);
  const body = clamp(o.body as string | undefined, 220);
  if (!title || !body) return null;
  return { title, body };
}

function clampFaqItem(item: unknown): FaqItem | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const q = clamp(o.q as string | undefined, 200);
  const a = clamp(o.a as string | undefined, 800);
  if (!q || !a) return null;
  return { q, a };
}

/**
 * Pad `current` with elements from `fallback` until it has at least `minLen` items
 * and then trim to at most `maxLen`. Items already present are kept first; we never
 * duplicate items already present in `current` by structural equality.
 */
function padArray<T>(current: T[], fallback: T[], minLen: number, maxLen: number): T[] {
  const out = current.slice(0, maxLen);
  if (out.length >= minLen) return out;
  const used = new Set(out.map((x) => JSON.stringify(x)));
  for (const item of fallback) {
    if (out.length >= minLen) break;
    const key = JSON.stringify(item);
    if (used.has(key)) continue;
    out.push(item);
    used.add(key);
  }
  return out.slice(0, maxLen);
}

/**
 * Try to "rescue" an almost-valid LLM response by clamping over-long strings
 * and padding too-short arrays with fallback items. Returns the parsed
 * LandingContent on success, or null if the rescue still doesn't satisfy
 * the schema (caller is expected to fall back).
 */
export function normalizeLandingContent(
  parsed: unknown,
  fallback: LandingContent,
): LandingContent | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const obj: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };

  for (const [key, max] of SINGLE_STRING_LIMITS) {
    clampStringField(obj, key as string, max);
  }

  const heroStats = (Array.isArray(obj.heroStats) ? obj.heroStats : [])
    .map(clampHeroStat)
    .filter((x): x is HeroStat => x !== null);
  obj.heroStats = padArray(heroStats, fallback.heroStats, 2, 4);

  const whyNowReasons = (Array.isArray(obj.whyNowReasons) ? obj.whyNowReasons : [])
    .map(clampReasonCard)
    .filter((x): x is ReasonCard => x !== null);
  obj.whyNowReasons = padArray(whyNowReasons, fallback.whyNowReasons, 3, 4);

  const blogTeasers = (Array.isArray(obj.blogTeasers) ? obj.blogTeasers : [])
    .map(clampBlogTeaser)
    .filter((x): x is BlogTeaser => x !== null);
  obj.blogTeasers = padArray(blogTeasers, fallback.blogTeasers, 3, 4);

  const forWhomItems = clampArrayOfStrings(obj.forWhomItems, 200);
  obj.forWhomItems = padArray(forWhomItems, fallback.forWhomItems, 5, 8);

  const whyAuthorCards = (Array.isArray(obj.whyAuthorCards) ? obj.whyAuthorCards : [])
    .map(clampWhyAuthorCard)
    .filter((x): x is WhyAuthorCard => x !== null);
  obj.whyAuthorCards = padArray(whyAuthorCards, fallback.whyAuthorCards, 4, 5);

  const faqItems = (Array.isArray(obj.faqItems) ? obj.faqItems : [])
    .map(clampFaqItem)
    .filter((x): x is FaqItem => x !== null);
  obj.faqItems = padArray(faqItems, fallback.faqItems, 4, 8);

  const result = LandingContentSchema.safeParse(obj);
  return result.success ? result.data : null;
}

function unwrapLandingContent(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed;
  const obj = parsed as Record<string, unknown>;
  for (const key of ['landingContent', 'landing', 'content', 'data', 'result'] as const) {
    const val = obj[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) return val;
  }
  return parsed;
}

export async function generateLandingContent(
  llm: LlmClient,
  input: GenerateLandingContentInput,
): Promise<LandingContent> {
  const payload = {
    insight: input.insight,
    post: {
      marketingTitle: input.post.marketingTitle,
      marketingText: input.post.marketingText,
    },
    primaryCollection: input.matched.primary,
    relatedCollections: input.matched.related.map((c) => ({
      url: c.url,
      title: c.title,
      purpose: c.purpose,
      pageType: c.pageType,
      ...(c.tourCount !== undefined ? { tourCount: c.tourCount } : {}),
    })),
    country: input.insight.country,
    travelAngle: input.insight.travelAngle,
  };

  logger.info({ country: input.insight.country }, 'Generating landing content blocks');

  let raw: string;
  try {
    raw = await llm.complete({
      system: input.systemPrompt,
      user: JSON.stringify(payload, null, 2),
      jsonMode: true,
      maxTokens: input.maxTokens ?? 3500,
      temperature: input.temperature ?? 0.5,
    });
  } catch (err) {
    logger.warn({ err }, 'Landing content LLM call failed — using fallback');
    return buildFallbackContent(input);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (err) {
    logger.warn({ err, raw: raw.slice(0, 400) }, 'Landing content JSON parse failed — using fallback');
    return buildFallbackContent(input);
  }

  parsed = unwrapLandingContent(parsed);

  const direct = LandingContentSchema.safeParse(parsed);
  if (direct.success) {
    return decorateContent(direct.data);
  }

  const fallback = buildFallbackContent(input);
  const rescued = normalizeLandingContent(parsed, fallback);
  if (rescued) {
    logger.info(
      { issues: direct.error.issues.slice(0, 3) },
      'Landing content rescued by normalizer (clamped strings / padded arrays)',
    );
    return decorateContent(rescued);
  }

  logger.warn(
    { issues: direct.error.issues.slice(0, 5) },
    'Landing content validation failed — using fallback',
  );
  return fallback;
}
