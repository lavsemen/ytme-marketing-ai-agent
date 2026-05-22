import { describe, it, expect } from 'vitest';
import {
  countStemMatches,
  detectCitiesInText,
  extractInsightKeywords,
  normalizeText,
} from '../src/modules/tours/insightKeywords.js';
import type { TravelInsight } from '../src/types/insight.js';

function insight(overrides: Partial<TravelInsight> = {}): TravelInsight {
  return {
    title: 'Test',
    sourceUrl: 'https://example.com/x',
    sourceName: 'Example',
    shortSummary: 'Краткое описание.',
    country: 'Турция',
    travelAngle: 'спокойный отдых',
    confidenceScore: 0.8,
    ...overrides,
  };
}

describe('insightKeywords › normalizeText', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeText('Привет, Мир!')).toBe('привет мир');
    expect(normalizeText('Pamukkale—термальные источники')).toBe('pamukkale термальные источники');
  });
  it('handles null/empty', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText('   ')).toBe('');
  });
});

describe('insightKeywords › countStemMatches', () => {
  it('returns substring hit count, capped at one per stem', () => {
    expect(countStemMatches('Термальный отдых в Памуккале', ['терма', 'памукк'])).toBe(2);
    expect(countStemMatches('Термальный отдых', ['отсутс'])).toBe(0);
  });
  it('is case-insensitive', () => {
    expect(countStemMatches('Cappadocia Hot Air Balloon', ['cappad'])).toBe(1);
  });
  it('skips empty stems', () => {
    expect(countStemMatches('text', ['', 'tex'])).toBe(1);
  });
});

describe('insightKeywords › detectCitiesInText', () => {
  it('detects known Turkish cities in news summary', () => {
    const found = detectCitiesInText(
      'В Памуккале открыли новый термальный курорт. Также в Каппадокии стартовал сезон шаров.',
      'Турция',
    );
    expect(found).toEqual(expect.arrayContaining(['памуккале', 'каппадокия']));
  });
  it('returns [] for unknown country', () => {
    expect(detectCitiesInText('Бишкек прекрасен', 'Wakanda')).toEqual([]);
  });
  it('returns [] for null/empty text', () => {
    expect(detectCitiesInText(null, 'Турция')).toEqual([]);
    expect(detectCitiesInText('', 'Турция')).toEqual([]);
  });
});

describe('insightKeywords › extractInsightKeywords', () => {
  it('extracts primary stems from travelAngle/audience/season/city', () => {
    const kw = extractInsightKeywords(
      insight({
        travelAngle: 'термальные источники и спа',
        targetAudience: 'премиальные путешественники',
        seasonality: 'круглый год',
        city: 'Памуккале',
      }),
    );
    // "термальные" → "термал", "источники" → "источн", "премиальные" → "премиа", "круглый" → "круглы", "памуккале" → "памукк"
    expect(kw.primary).toEqual(
      expect.arrayContaining(['термал', 'источн', 'премиа', 'круглы', 'памукк']),
    );
  });

  it('drops generic domain stop-words (tour/trip/путешествие)', () => {
    const kw = extractInsightKeywords(
      insight({ travelAngle: 'тур по Италии с гастрономическим уклоном' }),
    );
    // "тур" must not appear (it's a stop-word); but "гастрономическим" should produce "гастро"
    expect(kw.primary).not.toContain('тур');
    expect(kw.primary).toContain('гастро');
  });

  it('detects locations from shortSummary even when insight.city is empty', () => {
    const kw = extractInsightKeywords(
      insight({
        country: 'Турция',
        shortSummary: 'В Каппадокии открыли новый отель для авторских туров.',
        travelAngle: 'авторские маршруты',
      }),
    );
    expect(kw.detectedLocations).toContain('каппадокия');
    // detected location is also pre-stemmed and added to primary
    expect(kw.primary).toContain('каппад');
  });

  it('separates secondary keywords from summary first sentence', () => {
    const kw = extractInsightKeywords(
      insight({
        travelAngle: 'гастрономия',
        shortSummary:
          'Открытие винного фестиваля в Тоскане. Второе предложение про что-то другое.',
        country: 'Италия',
      }),
    );
    expect(kw.primary).toContain('гастро');
    // "винного" → "винног", "фестиваля" → "фестив", "открытие" → "открыт", "тоскане" → "тоскан"
    // Should appear in secondary (from first sentence of summary)
    expect(kw.secondary).toEqual(
      expect.arrayContaining(['винног', 'фестив']),
    );
    // "тоскане" detected as italy city → moved to primary, so NOT in secondary
    expect(kw.secondary).not.toContain('тоскан');
  });

  it('handles missing optional fields gracefully', () => {
    const kw = extractInsightKeywords({
      title: 'X',
      sourceUrl: 'https://e/x',
      sourceName: 'E',
      shortSummary: 'Short.',
      country: 'Турция',
      travelAngle: 'spa',
      confidenceScore: 0.5,
    });
    expect(kw.primary).toBeDefined();
    expect(kw.secondary).toBeDefined();
    expect(kw.detectedLocations).toEqual([]);
  });

  it('keeps short but informative words above MIN_TOKEN_LENGTH=4', () => {
    const kw = extractInsightKeywords(
      insight({ travelAngle: 'спа и серфинг' }),
    );
    // "спа" is only 3 chars → dropped. "серфинг" → "серфин"
    expect(kw.primary).not.toContain('спа');
    expect(kw.primary).toContain('серфин');
  });
});
