import type { LlmClient } from './llmClient.js';
import { extractJson } from './anthropicClient.js';
import { LandingContentSchema, type LandingContent } from '../../types/landingContent.js';
import type { TravelInsight } from '../../types/insight.js';
import type { MarketingPost } from '../../types/post.js';
import type { Tour } from '../../types/tour.js';
import { logger } from '../../utils/logger.js';

export interface GenerateLandingContentInput {
  insight: TravelInsight;
  post: MarketingPost;
  tours: Tour[];
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

function buildFallbackContent(input: GenerateLandingContentInput): LandingContent {
  const country = input.insight.country || 'выбранную страну';
  const angle = input.insight.travelAngle || 'авторские туры';

  return decorateContent(
    LandingContentSchema.parse({
      heroEyebrow: `Авторские туры · ${country}`,
      heroSubtitle: input.insight.shortSummary,
      heroStats: [
        { label: 'Готовые путешествия со смыслом' },
        { label: 'Авторский маршрут' },
        { label: '4.9★ рейтинг туров' },
      ],
      whyNowTitle: `${country}: почему сейчас`,
      whyNowReasons: [
        { title: 'Подходящий момент', body: input.insight.shortSummary },
        { title: 'Готовая программа', body: 'Тревел-эксперт собрал маршрут: вам остаётся выбрать дату.' },
        { title: 'Меньше хлопот', body: 'Не нужно самостоятельно собирать перелёты, ночёвки и активности.' },
        { title: 'Атмосфера группы', body: 'Едете в небольшой компании единомышленников, а не в одиночку.' },
      ],
      collectionTitle: `Готовая подборка туров в ${country}`,
      collectionDesc:
        'Откройте полный каталог направления — все актуальные туры с фильтрами по датам, цене и формату.',
      toursTitle: `Туры в ${country}`,
      toursLead: 'Каждый тур — авторский маршрут с тревел-экспертом. Выберите формат, который подходит вам.',
      howToGetTitle: `Как добраться до ${country}`,
      howToGetDesc:
        'Проверьте удобные рейсы и стоимость билетов на ваши даты, чтобы заранее оценить полный бюджет поездки.',
      esimDesc:
        'Купите eSIM заранее, чтобы сразу после прилёта пользоваться картами, мессенджерами, переводчиком и такси.',
      blogTeasers: [
        { title: `Что нужно знать перед поездкой в ${country}`, desc: 'Виза, документы и базовая подготовка.', tag: 'Лайфхаки' },
        { title: `Кухня ${country}`, desc: 'Что попробовать и где искать лучшие места.', tag: 'Кухня' },
        { title: `Когда лучше ехать в ${country}`, desc: 'Сезоны, погода и важные нюансы по месяцам.', tag: 'Страны' },
        { title: `Маршруты по ${country}`, desc: 'Идеи, как построить программу под себя.', tag: 'Маршруты' },
      ],
      forWhomTitle: 'Эти туры подойдут, если вы:',
      forWhomItems: [
        `Хотите увидеть ${country} глубже, чем в обычной поездке`,
        'Не хотите самостоятельно собирать маршрут',
        'Хотите путешествовать с тревел-экспертом',
        'Едете один/одна или хотите быть в группе',
        'Любите насыщенные маршруты с чёткой программой',
        'Хотите заранее понимать бюджет и формат',
      ],
      whyAuthorCards: [
        { title: 'Маршрут уже собран', body: 'Не нужно вручную собирать локации, переезды и ночёвки — всё готово.' },
        { title: 'Тревел-эксперт рядом', body: `Человек, который знает ${country} изнутри и решает вопросы на месте.` },
        { title: 'Понятная программа', body: 'Вы заранее видите, что будет каждый день и что включено в стоимость.' },
        { title: 'Можно ехать одному', body: 'В авторских турах часто едут соло — на месте группа единомышленников.' },
        { title: 'Понятный бюджет', body: 'Тур, авиабилеты и связь собраны на одной странице.' },
      ],
      faqItems: [
        { q: `Нужна ли виза в ${country}?`, a: 'Проверьте актуальные требования на сайте посольства перед бронированием.' },
        { q: 'Авиабилеты входят в стоимость тура?', a: 'Обычно авиабилеты оплачиваются отдельно. На странице есть кнопка проверки билетов.' },
        { q: 'Зачем покупать eSIM заранее?', a: 'Чтобы сразу после прилёта быть на связи: карты, мессенджеры, такси, переводчик.' },
        { q: 'Как понять, какой тур выбрать?', a: 'Смотрите даты, длительность, цену, уровень активности и формат. Можно открыть общую подборку.' },
        { q: 'Можно ли поехать одному?', a: 'Да, в авторские туры часто едут соло. На месте вы путешествуете в группе единомышленников.' },
        { q: 'Что если ни один тур не подходит?', a: 'Вы можете сделать запрос на индивидуальный тур — оставьте заявку на YouTravel.me.' },
      ],
      finalCtaHeadline: `${angle} с YouTravel.me`,
      finalCtaSub:
        'Посмотрите туры, откройте подборку по направлению, проверьте авиабилеты и заранее подключите eSIM.',
    }),
  );
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
    tours: input.tours.map((t) => ({
      id: t.id,
      title: t.title,
      url: t.url,
      ...(t.duration ? { duration: t.duration } : {}),
      ...(t.price ? { price: t.price } : {}),
      ...(t.country ? { country: t.country } : {}),
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

  const result = LandingContentSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn(
      { issues: result.error.issues.slice(0, 5) },
      'Landing content validation failed — using fallback',
    );
    return buildFallbackContent(input);
  }

  return decorateContent(result.data);
}
