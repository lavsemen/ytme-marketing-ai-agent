import { describe, it, expect } from 'vitest';
import {
  coerceTravelInsightArray,
  isEmptyInfopovodReport,
  synthesizeLowConfidenceInsight,
} from '../src/modules/ai/newsAnalyzer.js';
import { TravelInsightArraySchema } from '../src/types/insight.js';

const sampleInsight = {
  title: 'Test news',
  sourceUrl: 'https://example.com/news',
  sourceName: 'Example',
  shortSummary: 'Summary',
  country: 'Италия',
  travelAngle: 'Культура',
  confidenceScore: 0.8,
};

const sampleNews = [
  {
    title: 'Headline',
    url: 'https://example.com/a',
    sourceName: 'Lenta',
    summary: 'Text',
    sourceId: 'lenta',
    language: 'ru' as const,
  },
];

describe('coerceTravelInsightArray', () => {
  it('passes through a valid array', () => {
    const input = [sampleInsight];
    expect(coerceTravelInsightArray(input)).toEqual(input);
  });

  it('unwraps { insights: [...] }', () => {
    expect(coerceTravelInsightArray({ insights: [sampleInsight] })).toEqual([sampleInsight]);
  });

  it('unwraps empty { infopovodList: [] }', () => {
    expect(coerceTravelInsightArray({ infopovodList: [] })).toEqual([]);
  });

  it('wraps a single insight object', () => {
    expect(coerceTravelInsightArray(sampleInsight)).toEqual([sampleInsight]);
  });
});

describe('isEmptyInfopovodReport', () => {
  it('detects report object with rejectedNews', () => {
    expect(
      isEmptyInfopovodReport({
        infopovodList: [],
        rejectedNews: [{ title: 'x', reason: 'y' }],
        foundCount: 0,
      }),
    ).toBe(true);
  });

  it('returns false for valid insight array input', () => {
    expect(isEmptyInfopovodReport([sampleInsight])).toBe(false);
  });
});

describe('synthesizeLowConfidenceInsight', () => {
  it('produces valid TravelInsight with low score', () => {
    const insight = synthesizeLowConfidenceInsight(sampleNews);
    expect(TravelInsightArraySchema.safeParse([insight]).success).toBe(true);
    expect(insight.confidenceScore).toBeLessThan(0.3);
    expect(insight.title).toBe('Headline');
  });
});
