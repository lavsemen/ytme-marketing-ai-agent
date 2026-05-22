import { z } from 'zod';

export const MarketingPostSchema = z.object({
  marketingTitle: z.string().min(1),
  marketingText: z.string().min(1),
  seoTitle: z.string().min(1).max(120),
  seoDescription: z.string().min(1).max(300),
  ogTitle: z.string().min(1).max(120),
  ogDescription: z.string().min(1).max(300),
  imagePrompt: z.string().optional(),
});

export type MarketingPost = z.infer<typeof MarketingPostSchema>;
