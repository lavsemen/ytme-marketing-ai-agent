const PAT_KEY = 'ytme.admin.pat';

export function getStoredPat(): string | null {
  try {
    return window.localStorage.getItem(PAT_KEY);
  } catch {
    return null;
  }
}

export function setStoredPat(pat: string): void {
  window.localStorage.setItem(PAT_KEY, pat);
}

export function clearStoredPat(): void {
  window.localStorage.removeItem(PAT_KEY);
}
