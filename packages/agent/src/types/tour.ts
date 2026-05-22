import { z } from 'zod';

export const TourSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  imageUrl: z.string().url().optional(),
  shortDescription: z.string().optional(),
  price: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  duration: z.string().optional(),
  dates: z.array(z.string()).optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  tags: z.array(z.string()).optional(),
  reviewsCount: z.number().int().min(0).optional(),
});

export type Tour = z.infer<typeof TourSchema>;

export const TourSearchInputSchema = z.object({
  country: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  tags: z.array(z.string()).optional(),
  season: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type TourSearchInput = z.infer<typeof TourSearchInputSchema>;
