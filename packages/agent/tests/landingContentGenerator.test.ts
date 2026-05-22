import { describe, it, expect } from 'vitest';
import {
  buildFallbackContent,
  normalizeLandingContent,
} from '../src/modules/ai/landingContentGenerator.js';
import { LandingContentSchema, type LandingContent } from '../src/types/landingContent.js';
import type { TravelInsight } from '../src/types/insight.js';
import type { MarketingPost } from '../src/types/post.js';

function insight(overrides: Partial<TravelInsight> = {}): TravelInsight {
  return {
    title: 'Test news title',
    sourceUrl: 'https://example.com/news/1',
    sourceName: 'Example',
    shortSummary: 'Краткое описание новости.',
    country: 'Турция',
    travelAngle: 'Авторские туры по Каппадокии',
    confidenceScore: 0.7,
    ...overrides,
  };
}

function post(): MarketingPost {
  return {
    marketingTitle: 'Поехали в Турцию',
    marketingText: 'Текст поста.',
    seoTitle: 'SEO Title',
    seoDescription: 'SEO description.',
    ogTitle: 'OG Title',
    ogDescription: 'OG description.',
  };
}

describe('landingContentGenerator › buildFallbackContent', () => {
  it('produces a schema-valid content for typical insight', () => {
    const content = buildFallbackContent({
      insight: insight(),
      post: post(),
      tours: [],
      systemPrompt: 'sys',
    });
    expect(() => LandingContentSchema.parse(content)).not.toThrow();
    expect(content.whyAuthorCards).toHaveLength(5);
    expect(content.whyNowReasons).toHaveLength(4);
  });

  it('clamps a very long shortSummary so it fits whyNowReasons[0].body (≤280) and heroSubtitle (≤320)', () => {
    const longSummary = 'Очень длинная сводка. '.repeat(40);
    expect(longSummary.length).toBeGreaterThan(320);

    const content = buildFallbackContent({
      insight: insight({ shortSummary: longSummary }),
      post: post(),
      tours: [],
      systemPrompt: 'sys',
    });
    expect(() => LandingContentSchema.parse(content)).not.toThrow();
    expect(content.heroSubtitle.length).toBeLessThanOrEqual(320);
    expect(content.whyNowReasons[0]!.body.length).toBeLessThanOrEqual(280);
    expect(content.whyNowReasons[0]!.body).toMatch(/…$/);
  });

  it('clamps very long country/angle so derived titles stay under their limits', () => {
    const longCountry = 'Страна'.repeat(40);
    const longAngle = 'авторский тур '.repeat(20);

    const content = buildFallbackContent({
      insight: insight({ country: longCountry, travelAngle: longAngle }),
      post: post(),
      tours: [],
      systemPrompt: 'sys',
    });
    expect(() => LandingContentSchema.parse(content)).not.toThrow();
    expect(content.heroEyebrow.length).toBeLessThanOrEqual(60);
    expect(content.whyNowTitle.length).toBeLessThanOrEqual(120);
    expect(content.toursTitle.length).toBeLessThanOrEqual(120);
    expect(content.finalCtaHeadline.length).toBeLessThanOrEqual(180);
  });

  it('falls back to literal defaults when insight strings are whitespace-only', () => {
    const content = buildFallbackContent({
      insight: insight({ country: '   ', travelAngle: '   ', shortSummary: '   ' }),
      post: post(),
      tours: [],
      systemPrompt: 'sys',
    });
    expect(() => LandingContentSchema.parse(content)).not.toThrow();
    expect(content.heroEyebrow).toContain('выбранную страну');
    expect(content.whyNowReasons[0]!.body.length).toBeGreaterThan(0);
  });
});

describe('landingContentGenerator › normalizeLandingContent', () => {
  function fallback(): LandingContent {
    return buildFallbackContent({
      insight: insight(),
      post: post(),
      tours: [],
      systemPrompt: 'sys',
    });
  }

  it('returns null for non-object input', () => {
    expect(normalizeLandingContent('not an object', fallback())).toBeNull();
    expect(normalizeLandingContent([], fallback())).toBeNull();
    expect(normalizeLandingContent(null, fallback())).toBeNull();
  });

  it('pads whyAuthorCards from fallback when LLM returned too few (regression for original bug)', () => {
    const fb = fallback();
    const llmOutput: Record<string, unknown> = {
      ...fb,
      whyAuthorCards: [
        { title: 'Один', body: 'Описание одной карточки.' },
        { title: 'Два', body: 'Описание второй карточки.' },
      ],
    };

    const normalized = normalizeLandingContent(llmOutput, fb);
    expect(normalized).not.toBeNull();
    expect(normalized!.whyAuthorCards.length).toBeGreaterThanOrEqual(4);
    expect(normalized!.whyAuthorCards.length).toBeLessThanOrEqual(5);
    expect(normalized!.whyAuthorCards[0]!.title).toBe('Один');
    expect(normalized!.whyAuthorCards[1]!.title).toBe('Два');
  });

  it('clamps over-long body in whyNowReasons (≤280)', () => {
    const fb = fallback();
    const tooLong = 'a'.repeat(500);
    const llmOutput: Record<string, unknown> = {
      ...fb,
      whyNowReasons: [
        { title: 'Подходящий момент', body: tooLong },
        { title: 'Готовая программа', body: 'OK' },
        { title: 'Меньше хлопот', body: 'OK' },
      ],
    };

    const normalized = normalizeLandingContent(llmOutput, fb);
    expect(normalized).not.toBeNull();
    expect(normalized!.whyNowReasons[0]!.body.length).toBeLessThanOrEqual(280);
  });

  it('clamps over-long heroEyebrow and heroSubtitle', () => {
    const fb = fallback();
    const llmOutput: Record<string, unknown> = {
      ...fb,
      heroEyebrow: 'X'.repeat(200),
      heroSubtitle: 'Y'.repeat(1000),
    };

    const normalized = normalizeLandingContent(llmOutput, fb);
    expect(normalized).not.toBeNull();
    expect(normalized!.heroEyebrow.length).toBeLessThanOrEqual(60);
    expect(normalized!.heroSubtitle.length).toBeLessThanOrEqual(320);
  });

  it('drops malformed array items (missing required fields) and pads from fallback', () => {
    const fb = fallback();
    const llmOutput: Record<string, unknown> = {
      ...fb,
      faqItems: [
        { q: 'OK?', a: 'OK answer.' },
        { q: '' }, // dropped: missing `a` and empty `q`
        { q: 'Another?', a: 'Another answer.' },
      ],
    };

    const normalized = normalizeLandingContent(llmOutput, fb);
    expect(normalized).not.toBeNull();
    expect(normalized!.faqItems.length).toBeGreaterThanOrEqual(4);
    expect(normalized!.faqItems[0]!.q).toBe('OK?');
    expect(normalized!.faqItems[1]!.q).toBe('Another?');
  });

  it('pads short forWhomItems string array', () => {
    const fb = fallback();
    const llmOutput: Record<string, unknown> = {
      ...fb,
      forWhomItems: ['Only one', 'Two', ''],
    };

    const normalized = normalizeLandingContent(llmOutput, fb);
    expect(normalized).not.toBeNull();
    expect(normalized!.forWhomItems.length).toBeGreaterThanOrEqual(5);
    expect(normalized!.forWhomItems[0]).toBe('Only one');
    expect(normalized!.forWhomItems[1]).toBe('Two');
  });

  it('returns null when the candidate is so broken that even padding cannot satisfy the schema', () => {
    const fb = fallback();
    const broken: Record<string, unknown> = {
      ...fb,
      heroEyebrow: 12345 as unknown as string,
    };
    delete (broken as Record<string, unknown>).heroEyebrow;
    broken.heroEyebrow = '';

    const normalized = normalizeLandingContent(broken, fb);
    expect(normalized).toBeNull();
  });
});
