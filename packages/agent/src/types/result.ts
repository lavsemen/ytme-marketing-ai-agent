import { z } from 'zod';
import { TravelInsightSchema } from './insight.js';
import { LandingInfoSchema } from './landing.js';
import { TourSchema } from './tour.js';

export const PipelineResultSchema = z.object({
  news: z.object({
    title: z.string(),
    sourceName: z.string(),
    sourceUrl: z.string().url(),
    summary: z.string(),
  }),
  insight: TravelInsightSchema,
  tours: z.array(TourSchema).min(1),
  post: z.object({
    marketingTitle: z.string(),
    marketingText: z.string(),
    landingUrl: z.string().url(),
    imageUrl: z.string().url().optional(),
    imagePrompt: z.string().optional(),
  }),
  landing: LandingInfoSchema,
  meta: z.object({
    createdAt: z.string().datetime(),
    agentVersion: z.string(),
    runId: z.string().optional(),
  }),
});

export type PipelineResult = z.infer<typeof PipelineResultSchema>;

export const ResultMetaSchema = z.object({
  slug: z.string(),
  createdAt: z.string().datetime(),
  newsTitle: z.string(),
  country: z.string().optional(),
  toursCount: z.number().int().min(0),
  landingUrl: z.string().url(),
});

export type ResultMeta = z.infer<typeof ResultMetaSchema>;

export const ResultIndexSchema = z.array(ResultMetaSchema);

export type ResultIndex = z.infer<typeof ResultIndexSchema>;
