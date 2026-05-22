import { describe, it, expect } from 'vitest';
import {
  buildIndexHtml,
  buildStylesCss,
  buildScriptJs,
  type LandingTemplateContext,
} from '../src/modules/landing/templates.js';

const ctx: LandingTemplateContext = {
  slug: 'kitay-bezviz',
  url: 'https://owner.github.io/repo/landings/kitay-bezviz/',
  heroImageUrl: 'https://example.com/hero.jpg',
  post: {
    marketingTitle: 'Китай теперь ближе: безвиз продлили',
    marketingText: 'До конца 2027 года в Китай можно ехать с одним загранпаспортом.\n\nЭто отличный шанс увидеть всё то, что давно хотелось.',
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
};

describe('landing templates', () => {
  it('renders required HTML elements', () => {
    const html = buildIndexHtml(ctx);
    expect(html).toMatch(/<!DOCTYPE html>/i);
    expect(html).toContain('<html lang="ru">');
    expect(html).toContain('Китай теперь ближе: безвиз продлили');
    expect(html).toContain('href="https://example.com/news/china"');
    expect(html).toContain('https://youtravel.me/tours/48212');
    expect(html).toContain('https://youtravel.me/tours/51267');
  });

  it('includes SEO meta tags', () => {
    const html = buildIndexHtml(ctx);
    expect(html).toContain('<title>Безвиз с Китаем 2027 — подборка туров</title>');
    expect(html).toContain('name="description" content="Россияне могут ехать в Китай без визы');
    expect(html).toContain('property="og:title" content="Китай без визы до 2027"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:image" content="https://example.com/hero.jpg"');
    expect(html).toContain('property="og:url"');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('<meta name="twitter:card"');
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

  it('renders tour cards with CTA', () => {
    const html = buildIndexHtml(ctx);
    expect((html.match(/class="tour-card__cta"/g) ?? []).length).toBe(2);
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

  it('builds CSS without obvious syntax issues', () => {
    const css = buildStylesCss();
    expect(css).toContain('.tour-card');
    expect(css).toContain('@media');
    expect((css.match(/\{/g) ?? []).length).toBe((css.match(/\}/g) ?? []).length);
  });

  it('builds JS as IIFE', () => {
    const js = buildScriptJs();
    expect(js).toMatch(/\(function/);
  });
});
