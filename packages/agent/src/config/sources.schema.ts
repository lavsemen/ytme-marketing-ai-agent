import { z } from 'zod';

export const SourceTypeSchema = z.enum(['rss', 'html', 'auto']);

export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'id must be kebab-case latin'),
  name: z.string().min(1),
  url: z.string().url(),
  enabled: z.boolean().default(true),
  language: z.string().min(2).max(5).default('ru'),
  type: SourceTypeSchema.default('auto'),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type Source = z.infer<typeof SourceSchema>;

export const SourcesFileSchema = z.array(SourceSchema);

export type SourcesFile = z.infer<typeof SourcesFileSchema>;
