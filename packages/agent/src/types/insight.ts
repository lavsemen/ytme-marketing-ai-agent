import { z } from 'zod';

export const TravelInsightSchema = z.object({
  title: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceName: z.string().min(1),
  shortSummary: z.string().min(1),
  country: z.string().min(1),
  region: z.string().optional(),
  city: z.string().optional(),
  travelAngle: z.string().min(1),
  seasonality: z.string().optional(),
  targetAudience: z.string().optional(),
  confidenceScore: z.number().min(0).max(1),
  reasonWhyRelevant: z.string().optional(),
});

export type TravelInsight = z.infer<typeof TravelInsightSchema>;

export const TravelInsightArraySchema = z
  .array(TravelInsightSchema)
  .min(1)
  .max(5);
