import { z } from 'zod';
import { TravelInsightSchema } from './insight.js';
import { LandingInfoSchema } from './landing.js';
import { TourSchema } from './tour.js';

const SettingsSnapshotSchema = z
  .object({
    brandName: z.string().optional(),
    brandVoice: z.string().optional(),
    defaultAudience: z.string().optional(),
    model: z.string().optional(),
    confidenceThreshold: z.number().optional(),
  })
  .partial();

const ResultMetaSchema_ = z.object({
  createdAt: z.string().datetime(),
  agentVersion: z.string(),
  runId: z.string().optional(),
  hint: z.string().optional(),
  settingsSnapshot: SettingsSnapshotSchema.optional(),
});

export const PipelineResultSchema = z.object({
  status: z.literal('success').default('success'),
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
  meta: ResultMetaSchema_,
});

export type PipelineResult = z.infer<typeof PipelineResultSchema>;

export const REJECTION_REASONS = [
  'no_news',
  'low_confidence',
  'unknown_country',
  'blocked_country',
  'no_tours',
  'llm_error',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const RejectedPipelineResultSchema = z.object({
  status: z.literal('rejected'),
  reason: z.enum(REJECTION_REASONS),
  message: z.string(),
  sourceId: z.string().optional(),
  newsSampled: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        sourceName: z.string(),
      }),
    )
    .default([]),
  insights: z.array(TravelInsightSchema).default([]),
  topInsight: TravelInsightSchema.optional(),
  meta: ResultMetaSchema_,
});

export type RejectedPipelineResult = z.infer<typeof RejectedPipelineResultSchema>;

export type PipelineRunResult = PipelineResult | RejectedPipelineResult;

export function isRejected(r: PipelineRunResult): r is RejectedPipelineResult {
  return r.status === 'rejected';
}

export const ResultMetaSchema = z.object({
  slug: z.string(),
  createdAt: z.string().datetime(),
  newsTitle: z.string(),
  country: z.string().optional(),
  toursCount: z.number().int().min(0).default(0),
  landingUrl: z.string().url().optional(),
  status: z.enum(['success', 'rejected']).default('success'),
  rejectionReason: z.enum(REJECTION_REASONS).optional(),
  rejectionMessage: z.string().optional(),
});

export type ResultMeta = z.infer<typeof ResultMetaSchema>;

export const ResultIndexSchema = z.array(ResultMetaSchema);

export type ResultIndex = z.infer<typeof ResultIndexSchema>;
