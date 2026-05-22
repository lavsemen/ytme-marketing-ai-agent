import { z } from 'zod';

export const LandingInfoSchema = z.object({
  slug: z.string().min(1),
  path: z.string().min(1),
  url: z.string().url(),
});

export type LandingInfo = z.infer<typeof LandingInfoSchema>;
