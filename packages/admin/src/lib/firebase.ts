import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GithubAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Centralised Firebase wiring for the admin SPA. Firebase is mandatory —
 * configs/runs/results/metrics all live in Firestore.
 *
 * Web config values come from Vite env vars (see root .env.example).
 */

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export function readFirebaseConfig(): FirebaseWebConfig {
  return {
    apiKey: (import.meta.env.VITE_FIREBASE_API_KEY ?? '').trim(),
    authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '').trim(),
    projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '').trim(),
    appId: (import.meta.env.VITE_FIREBASE_APP_ID ?? '').trim(),
  };
}

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;

/**
 * Surfaces a user-facing message when Firebase env vars are missing.
 * Returns null when the SPA is configured correctly.
 */
export function getFirebaseConfigError(): string | null {
  const cfg = readFirebaseConfig();
  const missing: string[] = [];
  if (!cfg.apiKey) missing.push('VITE_FIREBASE_API_KEY');
  if (!cfg.authDomain) missing.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!cfg.projectId) missing.push('VITE_FIREBASE_PROJECT_ID');
  if (!cfg.appId) missing.push('VITE_FIREBASE_APP_ID');
  if (missing.length > 0) {
    return (
      'Firebase не настроен: задайте ' +
      `${missing.join(', ')} в корневом .env или .env.local. ` +
      'На GitHub Pages: Repo → Settings → Secrets and variables → Actions → Variables ' +
      '(FIREBASE_WEB_API_KEY, FIREBASE_WEB_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_WEB_APP_ID). ' +
      'См. docs/firebase-setup.md.'
    );
  }
  if (!/^AIza[\w-]+$/.test(cfg.apiKey)) {
    return (
      'VITE_FIREBASE_API_KEY выглядит некорректно (ожидается ключ вида AIza… из Firebase Console → ' +
      'Project Settings → Your apps → Web). Проверьте GitHub Variable FIREBASE_WEB_API_KEY.'
    );
  }
  return null;
}

function getApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  const configError = getFirebaseConfigError();
  if (configError) {
    throw new Error(configError);
  }
  const existing = getApps()[0];
  if (existing) {
    cachedApp = existing;
    return existing;
  }
  const cfg = readFirebaseConfig();
  cachedApp = initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    appId: cfg.appId,
  });
  return cachedApp;
}

export function getDb(): Firestore {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getApp());
  return cachedDb;
}

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getApp());
  return cachedAuth;
}

export interface FirebaseSignInResult {
  user: User;
  /** GitHub access token returned by the OAuth flow. Useful when the SPA
   *  also wants to call workflow_dispatch — see useAuth for storage rules. */
  githubAccessToken: string | null;
}

export async function signInWithGithub(): Promise<FirebaseSignInResult> {
  const provider = new GithubAuthProvider();
  // Scopes needed for the existing PAT-equivalent functionality (running
  // workflows). User can still skip granting these by toggling auth on
  // GitHub side; in that case the access token simply won't carry them.
  provider.addScope('workflow');
  provider.addScope('repo');
  const result = await signInWithPopup(getFirebaseAuth(), provider);
  const credential = GithubAuthProvider.credentialFromResult(result);
  return {
    user: result.user,
    githubAccessToken: credential?.accessToken ?? null,
  };
}

export async function signOutFromFirebase(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export { onAuthStateChanged };
export type { User };
