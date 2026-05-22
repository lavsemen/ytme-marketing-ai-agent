import { z } from 'zod';

export const SerpDateSchema = z.object({
  id: z.number().nullish(),
  date_from: z.number().nullish(),
  date_to: z.number().nullish(),
  guarantee: z.boolean().nullish(),
  is_weekend: z.boolean().nullish(),
  free_spaces: z.number().nullish(),
  group_size: z.number().nullish(),
  actual_price: z.number().nullish(),
  price: z.number().nullish(),
});

export const SerpExpertSchema = z.object({
  id: z.number().nullish(),
  rating: z.number().nullish(),
  count_reviews: z.number().nullish(),
  name: z.string().nullish(),
  avatar: z.string().nullish(),
  link: z.string().nullish(),
});

export const SerpTypeSchema = z.object({
  main: z.boolean().optional(),
  title: z.string(),
});

export const SerpItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  preview_image: z.string().nullish(),
  continents: z.array(z.string()).nullish(),
  countries: z.array(z.string()).nullish(),
  regions: z.array(z.string()).nullish(),
  locations: z.array(z.string()).nullish(),
  description: z.string().nullish(),
  types: z.array(SerpTypeSchema).nullish(),
  expert: SerpExpertSchema.nullish(),
  dates: z
    .object({
      total: z.number().nullish(),
      group_min_price: SerpDateSchema.nullish(),
      slice: z.array(SerpDateSchema).nullish(),
    })
    .nullish(),
  link: z.string(),
  activity: z.number().nullish(),
  comfort: z.number().nullish(),
  languages: z.array(z.string()).nullish(),
});

export type SerpItem = z.infer<typeof SerpItemSchema>;

export const SerpResponseSchema = z.object({
  error: z.boolean().optional(),
  data: z.object({
    total: z.number().optional(),
    items: z.array(SerpItemSchema),
  }),
});

export type SerpResponse = z.infer<typeof SerpResponseSchema>;
