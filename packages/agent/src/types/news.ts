import { z } from 'zod';

export const NewsItemSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  sourceName: z.string().min(1),
  sourceId: z.string().min(1),
  publishedAt: z.string().datetime().optional(),
  summary: z.string().optional(),
  text: z.string().optional(),
  imageUrl: z.string().url().optional(),
  language: z.string().min(2).max(5).optional(),
});

export type NewsItem = z.infer<typeof NewsItemSchema>;
