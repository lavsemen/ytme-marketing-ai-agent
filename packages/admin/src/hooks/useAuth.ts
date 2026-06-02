import { useCallback, useEffect, useRef, useState } from 'react';
import { getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  clearStoredGithubOauthToken,
  clearStoredPat,
  getStoredGithubOauthToken,
  getStoredPat,
  setStoredGithubOauthToken,
  setStoredPat,
} from '../lib/storage';
import {
  getFirebaseAuth,
  getFirebaseConfigError,
  onAuthStateChanged,
  signInWithGithub,
  signOutFromFirebase,
  type User as FirebaseUser,
} from '../lib/firebase';
import { refs } from '../api/db';

/**
 * Auth pipeline for the admin SPA — Firebase GitHub OAuth is the single
 * source of identity, gated by an allowlist in `users/{login}.admin`.
 *
 * The optional PAT is only used to dispatch GitHub workflows
 * (generate.yml / scheduled.yml) — Firebase OAuth scopes don't include
 * Actions:write, so users who want to launch a run from the UI need to
 * paste a fine-grained PAT once.
 */

export interface AuthState {
  /** GitHub PAT — optional, only used for workflow_dispatch. */
  pat: string | null;
  /** GitHub OAuth access token returned by Firebase Auth, if available. */
  githubOauthToken: string | null;
  /** GitHub user info (login + avatar) resolved from the Firebase session. */
  user: { login: string; avatar_url: string } | null;
  firebaseUser: FirebaseUser | null;
  /** Allowlist check from users/{login}.admin. Null = still resolving. */
  isAdmin: boolean | null;
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: AuthState = {
  pat: getStoredPat(),
  githubOauthToken: getStoredGithubOauthToken(),
  user: null,
  firebaseUser: null,
  isAdmin: null,
  loading: true,
  error: null,
};

export function useAuth() {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  // Avoid double-subscribing in StrictMode dev.
  const subscribed = useRef(false);

  useEffect(() => {
    if (subscribed.current) return;
    subscribed.current = true;

    const configError = getFirebaseConfigError();
    if (configError) {
      setState((s) => ({
        ...s,
        loading: false,
        error: configError,
      }));
      return;
    }

    let unsub: (() => void) | undefined;
    try {
      unsub = onAuthStateChanged(getFirebaseAuth(), async (fbUser) => {
      if (!fbUser) {
        setState((s) => ({
          ...s,
          firebaseUser: null,
          user: null,
          isAdmin: null,
          loading: false,
        }));
        return;
      }
      // The GitHub provider stores the login as `reloadUserInfo.screenName`
      // for the github.com provider entry. Fall back to displayName or email.
      const providerData = fbUser.providerData.find((p) => p.providerId === 'github.com');
      const login =
        providerData?.displayName ??
        (fbUser as unknown as { reloadUserInfo?: { screenName?: string } }).reloadUserInfo
          ?.screenName ??
        fbUser.displayName ??
        fbUser.email ??
        fbUser.uid;
      const avatar = providerData?.photoURL ?? fbUser.photoURL ?? '';
      let isAdmin = false;
      try {
        const userRef = refs.user(String(login));
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          isAdmin = Boolean(snap.data()?.admin);
        } else {
          // First sign-in: create the doc with admin=false so a maintainer
          // can promote the user from the Firebase console without giving
          // every authenticated GitHub account write access by default.
          await setDoc(userRef, {
            admin: false,
            email: fbUser.email ?? null,
            githubLogin: String(login),
            createdAt: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        // Permission error here usually means the rules haven't been
        // deployed yet — surface it instead of silently locking the user out.
        setState((s) => ({
          ...s,
          firebaseUser: fbUser,
          user: { login: String(login), avatar_url: avatar },
          isAdmin: false,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
        return;
      }
      setState((s) => ({
        ...s,
        firebaseUser: fbUser,
        user: { login: String(login), avatar_url: avatar },
        isAdmin,
        loading: false,
        error: isAdmin
          ? null
          : `Доступ ожидает подтверждения. Откройте Firebase Console → Firestore → users/${login} и поставьте admin=true.`,
      }));
    });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((s) => ({
        ...s,
        loading: false,
        error: msg.includes('invalid-api-key')
          ? 'Firebase API key отклонён. Проверьте GitHub Variable FIREBASE_WEB_API_KEY (ключ AIza… из Firebase Console → Web app).'
          : msg,
      }));
      return;
    }
    return () => {
      subscribed.current = false;
      unsub?.();
    };
  }, []);

  const loginWithGithubOauth = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { githubAccessToken } = await signInWithGithub();
      if (githubAccessToken) {
        setStoredGithubOauthToken(githubAccessToken);
        setState((s) => ({ ...s, githubOauthToken: githubAccessToken }));
      }
      // onAuthStateChanged listener will populate user / isAdmin.
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((s) => ({ ...s, loading: false, error: msg }));
      return false;
    }
  }, []);

  // Save PAT for workflow_dispatch. Does NOT verify scopes — keeps the UX
  // simple and matches the fact that GitHub returns a clear 403 at dispatch
  // time if the token is missing Actions:write.
  const savePat = useCallback((pat: string | null) => {
    if (pat && pat.trim()) {
      setStoredPat(pat.trim());
      setState((s) => ({ ...s, pat: pat.trim() }));
    } else {
      clearStoredPat();
      setState((s) => ({ ...s, pat: null }));
    }
  }, []);

  const logout = useCallback(async () => {
    clearStoredPat();
    clearStoredGithubOauthToken();
    try {
      await signOutFromFirebase();
    } catch {
      // ignore — clearing local state is enough for UX.
    }
    setState({
      ...INITIAL_STATE,
      pat: null,
      githubOauthToken: null,
      loading: false,
    });
  }, []);

  return {
    ...state,
    loginWithGithubOauth,
    savePat,
    logout,
  };
}
