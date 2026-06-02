import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { getEnv } from '../utils/env.js';
import { logger } from '../utils/logger.js';

/**
 * Lazy singleton over firebase-admin Firestore. Initialised on first call
 * and reused for the rest of the process lifetime.
 *
 * We support two credential sources, in order of preference:
 *  1. FIREBASE_SERVICE_ACCOUNT_JSON env var with the full service-account
 *     JSON inlined (used by CI / GitHub Actions secrets).
 *  2. GOOGLE_APPLICATION_CREDENTIALS path (standard ADC, useful for local
 *     development where the file is on disk).
 *
 * If neither is present we throw early — the alternative would be to fall
 * back to default ADC which on a developer laptop can silently pick up an
 * unintended account.
 */

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;

function normalizeServiceAccountRaw(raw: string): string {
  let s = raw.trim().replace(/^\uFEFF/, '');
  // .env / copy-paste often wraps the whole JSON in quotes.
  if (
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('"') && s.endsWith('"') && s.includes('"type"'))
  ) {
    s = s.slice(1, -1).trim();
  }
  // Sometimes only the inner object is pasted without surrounding noise trimmed.
  if (!s.startsWith('{')) {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
      s = s.slice(start, end + 1);
    }
  }
  return s;
}

function parseServiceAccountJson(raw: string): ServiceAccount {
  const normalized = normalizeServiceAccountRaw(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch (err) {
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${(err as Error).message}. ` +
        'Use minified one-line JSON (jq -c . key.json) or set GOOGLE_APPLICATION_CREDENTIALS to a file path. ' +
        'In GitHub Actions prefer writing the secret to a file — see generate.yml.',
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be a JSON object');
  }
  const obj = parsed as Record<string, unknown>;
  const required = ['project_id', 'client_email', 'private_key'];
  for (const key of required) {
    if (typeof obj[key] !== 'string' || !(obj[key] as string).trim()) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is missing "${key}"`);
    }
  }
  return {
    projectId: obj.project_id as string,
    clientEmail: obj.client_email as string,
    // private_key in JSON has escaped newlines; firebase-admin handles raw
    // PEM strings directly, but secret stores often double-escape. Normalise
    // both forms so the secret can be pasted as-is.
    privateKey: (obj.private_key as string).replace(/\\n/g, '\n'),
  };
}

function initApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps()[0];
  if (existing) {
    cachedApp = existing;
    return existing;
  }
  const env = getEnv();
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  // Prefer ADC file path (CI writes the secret to a temp file) over inline JSON —
  // multiline service-account JSON breaks easily when passed as an env var.
  if (credsPath) {
    cachedApp = initializeApp({
      ...(env.FIREBASE_PROJECT_ID ? { projectId: env.FIREBASE_PROJECT_ID } : {}),
    });
    return cachedApp;
  }
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const credentials = parseServiceAccountJson(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    cachedApp = initializeApp({
      credential: cert(credentials),
      ...(env.FIREBASE_PROJECT_ID ? { projectId: env.FIREBASE_PROJECT_ID } : {}),
    });
    return cachedApp;
  }
  throw new Error(
    'Firestore credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON (full service-account JSON) ' +
      'or GOOGLE_APPLICATION_CREDENTIALS (path to JSON file). See docs/firebase-setup.md.',
  );
}

export function getDb(): Firestore {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(initApp());
  try {
    // ignoreUndefinedProperties keeps the agent code clean — we can spread
    // optional fields without converting them to "null". `settings` throws
    // if it's already been called for this Firestore instance; harmless.
    cachedDb.settings({ ignoreUndefinedProperties: true });
  } catch (err) {
    logger.debug({ err }, 'Firestore settings already applied');
  }
  logger.debug('Firestore client initialised');
  return cachedDb;
}

export { FieldValue };
