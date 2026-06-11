import { z } from 'zod';

export const CatalogPageSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  pageClass: z.string().min(1),
  pageType: z.string().min(1),
  purpose: z.string().min(1),
  tourCount: z.number().int().nonnegative().optional(),
});

export type CatalogPage = z.infer<typeof CatalogPageSchema>;

export const MatchedCollectionsSchema = z.object({
  primary: CatalogPageSchema,
  related: z.array(CatalogPageSchema).min(1),
});

export type MatchedCollections = z.infer<typeof MatchedCollectionsSchema>;
