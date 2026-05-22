import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '../../../..');
const AGENT_ROOT = path.resolve(here, '../..');

// yarn workspace runs with cwd = packages/agent; load .env from monorepo root.
dotenv.config({ path: path.join(REPO_ROOT, '.env') });
dotenv.config({ path: path.join(AGENT_ROOT, '.env') });

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-5'),

  TOUR_CLIENT_MODE: z.enum(['real', 'mock']).default('real'),
  YOUTRAVEL_API_BASE_URL: z.string().url().default('https://youtravel.me'),
  YOUTRAVEL_IMAGE_BASE_URL: z.string().url().default('https://youtravel.me/'),
  YOUTRAVEL_API_TOKEN: z.string().optional(),

  LANDING_BASE_URL: z
    .string()
    .url()
    .default('https://example.github.io/ytme-marketing-ai-agent'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

export function requireAnthropicKey(env: Env): string {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is required. Set it in .env or GitHub Secrets.',
    );
  }
  return env.ANTHROPIC_API_KEY;
}
