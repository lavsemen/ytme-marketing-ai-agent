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

/** GitHub Actions sets missing secrets to ""; treat as unset. */
function emptyToUndefined(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    return trimmed;
  }
  return value;
}

const PLACEHOLDER_KEYS = new Set([
  'sk-ant-api03-REPLACE_WITH_YOUR_KEY',
  'your-anthropic-api-key',
]);

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-5'),

  TOUR_CLIENT_MODE: z.enum(['real', 'mock']).default('real'),
  YOUTRAVEL_API_BASE_URL: z.string().url().default('https://youtravel.me'),
  YOUTRAVEL_IMAGE_BASE_URL: z.string().url().default('https://youtravel.me/'),
  YOUTRAVEL_API_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  LANDING_BASE_URL: z
    .string()
    .url()
    .default('https://example.github.io/ytme-marketing-ai-agent'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Firestore is the only backend. PROJECT_ID and SERVICE_ACCOUNT_JSON are
  // required; see docs/firebase-setup.md.
  FIREBASE_PROJECT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  // Web SDK config for the embedded metrics tracker. Public-by-design values
  // (apiKey is not a secret — see docs/firebase-setup.md). When any of them is
  // missing the landing tracker silently no-ops.
  FIREBASE_WEB_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  FIREBASE_WEB_AUTH_DOMAIN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  FIREBASE_WEB_APP_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  // Slack bot (News2Trip) — optional; see .env.example
  SLACK_BOT_TOKEN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SLACK_CHANNEL_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
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
      'ANTHROPIC_API_KEY is required. Set it in .env (repo root) or GitHub Secrets.',
    );
  }
  if (PLACEHOLDER_KEYS.has(env.ANTHROPIC_API_KEY)) {
    throw new Error(
      'ANTHROPIC_API_KEY is still a placeholder. Create a key at https://console.anthropic.com/settings/keys ' +
        'and put it in .env (not the value from .env.example).',
    );
  }
  return env.ANTHROPIC_API_KEY;
}
