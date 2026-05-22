import { describe, it, expect } from 'vitest';
import {
  buildIndexHtml,
  buildStylesCss,
  buildScriptJs,
  type LandingTemplateContext,
} from '../src/modules/landing/templates.js';
import { LandingContentSchema } from '../src/types/landingContent.js';

const content = LandingContentSchema.parse({
  heroEyebrow: 'Авторские туры · Китай 2027',
  heroSubtitle: 'Горы Аватара, мегаполисы, безвиз для россиян. Время ехать.',
  heroStats: [
    { label: 'Готовые путешествия со смыслом' },
    { label: '30 дней без визы' },
    { label: '4.9★ рейтинг туров' },
  ],
  whyNowTitle: 'Китай стал ближе',
  whyNowReasons: [
    { title: 'Без визы 30 дней', body: 'Россияне въезжают в Китай без визы на срок до 30 дней.' },
    { title: 'Горы из «Аватара»', body: 'Чжанцзяцзе — вертикальные скалы и висячие мосты.' },
    { title: 'Культура-вселенная', body: '7000 лет истории и живые традиции.' },
    { title: 'Проще с туром', body: 'Не нужно собирать маршрут самостоятельно.' },
  ],
  collectionTitle: 'Готовая подборка туров в Китай',
  collectionDesc: 'Откройте полный каталог направления.',
  toursTitle: 'Туры в Китай',
  toursLead: 'Каждый тур — авторский маршрут с тревел-экспертом.',
  howToGetTitle: 'Как добраться до Китая',
  howToGetDesc: 'Проверьте удобные рейсы заранее.',
  esimDesc: 'Купите eSIM заранее, чтобы сразу быть на связи.',
  blogTeasers: [
    { title: 'Нужна ли виза в Китай', desc: 'Безвиз на 30 дней.', tag: 'Лайфхаки' },
    { title: 'Кухня Китая', desc: 'Что попробовать.', tag: 'Кухня' },
    { title: 'Когда лучше ехать', desc: 'Сезоны и погода.', tag: 'Страны' },
    { title: 'Маршруты по Китаю', desc: 'Идеи программы.', tag: 'Маршруты' },
  ],
  forWhomTitle: 'Эти туры подойдут, если вы:',
  forWhomItems: [
    'Хотите увидеть Китай глубже',
    'Не хотите собирать маршрут самостоятельно',
    'Хотите тревел-эксперта на месте',
    'Едете один/одна или в группе',
    'Любите насыщенные маршруты',
  ],
  whyAuthorCards: [
    { title: 'Маршрут уже собран', body: 'Всё готово.' },
    { title: 'Тревел-эксперт рядом', body: 'Знает Китай изнутри.' },
    { title: 'Понятная программа', body: 'Видите расписание заранее.' },
    { title: 'Можно ехать одному', body: 'На месте группа единомышленников.' },
    { title: 'Понятный бюджет', body: 'Всё собрано на одной странице.' },
  ],
  faqItems: [
    { q: 'Нужна ли виза?', a: 'Проверьте актуальные требования посольства.' },
    { q: 'Авиабилеты входят?', a: 'Обычно оплачиваются отдельно.' },
    { q: 'Зачем eSIM?', a: 'Чтобы сразу быть на связи.' },
    { q: 'Можно одному?', a: 'Да, в авторские туры часто едут соло.' },
  ],
  finalCtaHeadline: 'Выберите путешествие в Китай',
  finalCtaSub: 'Туры, подборка, авиабилеты и eSIM — на одной странице.',
});

const ctx: LandingTemplateContext = {
  slug: 'kitay-bezviz',
  url: 'https://owner.github.io/repo/landings/kitay-bezviz/',
  heroImageUrl: 'https://example.com/hero.jpg',
  post: {
    marketingTitle: 'Китай теперь ближе: безвиз продлили',
    marketingText:
      'До конца 2027 года в Китай можно ехать с одним загранпаспортом.\n\nЭто отличный шанс увидеть всё то, что давно хотелось.',
    seoTitle: 'Безвиз с Китаем 2027 — подборка туров',
    seoDescription: 'Россияне могут ехать в Китай без визы до конца 2027 года. Подобрали 5 авторских туров.',
    ogTitle: 'Китай без визы до 2027',
    ogDescription: 'Подборка авторских туров на YouTravel.me',
    imagePrompt: 'Горы Аватара в Чжанцзяцзе на рассвете',
  },
  insight: {
    title: 'Китай продлил безвиз для россиян до 2027',
    sourceUrl: 'https://example.com/news/china',
    sourceName: 'Example News',
    shortSummary: 'Китай продлил безвиз для россиян до 31 декабря 2027 года.',
    country: 'Китай',
    travelAngle: 'Безвиз снижает барьер для авторских туров',
    confidenceScore: 0.91,
  },
  news: {
    title: 'Китай продлил безвизовый режим до конца 2027 года',
    url: 'https://example.com/news/china',
    sourceName: 'Example News',
    sourceId: 'example',
    summary: 'Китай продлил безвизовый режим для граждан России до 31 декабря 2027 года.',
  },
  tours: [
    {
      id: '48212',
      title: 'Китай. Горы Аватара и Гуйлинь',
      url: 'https://youtravel.me/tours/48212',
      imageUrl: 'https://example.com/t1.jpg',
      price: 'от 185 000 ₽',
      rating: 4.9,
      duration: '11 дней',
      dates: ['15 окт 2026', '02 ноя 2026'],
      shortDescription: 'Горы Чжанцзяцзе и Гуйлинь.',
    },
    {
      id: '51267',
      title: 'Классический Китай',
      url: 'https://youtravel.me/tours/51267',
    },
  ],
  content,
};

describe('landing templates (brand kit)', () => {
  it('renders required HTML elements', () => {
    const html = buildIndexHtml(ctx);
    expect(html).toMatch(/<!DOCTYPE html>/i);
    expect(html).toContain('<html lang="ru">');
    expect(html).toContain('Китай теперь ближе: безвиз продлили');
    expect(html).toContain('href="https://youtravel.me/tours/48212"');
  });

  it('loads shared brand stylesheets', () => {
    const html = buildIndexHtml(ctx);
    expect(html).toContain('../_shared/colors_and_type.css');
    expect(html).toContain('../_shared/landing.css');
    expect(html).toContain('../_shared/assets/logo-wordmark.svg');
  });

  it('renders all 11 design-system blocks in order', () => {
    const html = buildIndexHtml(ctx);
    const blocks = [
      'class="yt-nav"',
      'class="hero-section"',
      'class="section-white why-now"',
      'class="section-bg tours-section"',
      'class="collection-section"',
      'class="section-white aviation-section"',
      'class="esim-section"',
      'class="section-white blog-section"',
      'class="section-bg for-whom-section"',
      'class="section-white why-author"',
      'class="section-bg faq-section"',
      'class="final-cta-section"',
      'class="site-footer"',
    ];
    let cursor = 0;
    for (const block of blocks) {
      const pos = html.indexOf(block, cursor);
      expect(pos, `block "${block}" must appear after position ${cursor}`).toBeGreaterThan(cursor - 1);
      cursor = pos + block.length;
    }
  });

  it('renders LandingContent fields into matching blocks', () => {
    const html = buildIndexHtml(ctx);
    expect(html).toContain('Авторские туры · Китай 2027');
    expect(html).toContain('Без визы 30 дней');
    expect(html).toContain('Готовая подборка туров в Китай');
    expect(html).toContain('Нужна ли виза?');
    expect(html).toContain('YOUTRAVEL');
    expect(html).toContain('Выберите путешествие в Китай');
  });

  it('includes SEO meta tags', () => {
    const html = buildIndexHtml(ctx);
    expect(html).toContain('<title>Безвиз с Китаем 2027 — подборка туров</title>');
    expect(html).toContain('property="og:image" content="https://example.com/hero.jpg"');
    expect(html).toContain('rel="canonical"');
  });

  it('includes JSON-LD structured data', () => {
    const html = buildIndexHtml(ctx);
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).toBeTruthy();
    const parsed = JSON.parse(match![1]!);
    expect(parsed['@type']).toBe('Article');
    expect(parsed.headline).toBe('Китай теперь ближе: безвиз продлили');
    expect(parsed.about.name).toBe('Китай');
  });

  it('renders tour cards', () => {
    const html = buildIndexHtml(ctx);
    expect((html.match(/class="tour-card"/g) ?? []).length).toBe(2);
    expect(html).toContain('Смотреть тур');
  });

  it('escapes HTML in user-controlled fields', () => {
    const dangerous: LandingTemplateContext = {
      ...ctx,
      post: { ...ctx.post, marketingTitle: '<script>alert(1)</script>' },
    };
    const html = buildIndexHtml(dangerous);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('per-landing CSS is a thin override file', () => {
    const css = buildStylesCss();
    expect(css.length).toBeLessThan(2000);
    expect((css.match(/\{/g) ?? []).length).toBe((css.match(/\}/g) ?? []).length);
  });

  it('script wires nav scroll, FAQ accordion, smooth scroll', () => {
    const js = buildScriptJs();
    expect(js).toMatch(/\(function/);
    expect(js).toContain('faq-open');
    expect(js).toContain('nav-scrolled');
    expect(js).toContain('scrollIntoView');
  });
});
