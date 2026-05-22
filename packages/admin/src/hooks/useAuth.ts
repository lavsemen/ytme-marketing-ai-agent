import { useEffect, useState, useCallback } from 'react';
import { getStoredPat, setStoredPat, clearStoredPat } from '../lib/storage';
import { getCurrentUser } from '../api/github';

export interface AuthState {
  pat: string | null;
  user: { login: string; avatar_url: string } | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    pat: getStoredPat(),
    user: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!state.pat || state.user) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    getCurrentUser(state.pat)
      .then((user) => {
        if (cancelled) return;
        setState((s) => ({ ...s, user, loading: false, error: null }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        clearStoredPat();
        setState({ pat: null, user: null, loading: false, error: msg });
      });
    return () => {
      cancelled = true;
    };
  }, [state.pat, state.user]);

  const login = useCallback(async (pat: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const user = await getCurrentUser(pat);
      setStoredPat(pat);
      setState({ pat, user, loading: false, error: null });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((s) => ({ ...s, loading: false, error: msg }));
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    clearStoredPat();
    setState({ pat: null, user: null, loading: false, error: null });
  }, []);

  return { ...state, login, logout };
}
