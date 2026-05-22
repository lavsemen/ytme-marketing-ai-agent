import { z } from 'zod';

/** LLM often returns null for omitted optional fields; z.string().optional() rejects null. */
const optionalString = () =>
  z.preprocess((val) => (val === null ? undefined : val), z.string().optional());

export const TravelInsightSchema = z.object({
  title: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceName: z.string().min(1),
  shortSummary: z.string().min(1),
  country: z.string().min(1),
  region: optionalString(),
  city: optionalString(),
  travelAngle: z.string().min(1),
  seasonality: optionalString(),
  targetAudience: optionalString(),
  confidenceScore: z.number().min(0).max(1),
  reasonWhyRelevant: optionalString(),
});

export type TravelInsight = z.infer<typeof TravelInsightSchema>;

export const TravelInsightArraySchema = z
  .array(TravelInsightSchema)
  .min(1)
  .max(5);
