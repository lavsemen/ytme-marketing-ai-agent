const PAT_KEY = 'ytme.admin.pat';
const GH_OAUTH_TOKEN_KEY = 'ytme.admin.ghOauthToken';

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

/**
 * GitHub access token coming from Firebase Auth's GitHub OAuth flow. It only
 * survives the popup callback, so we cache it in storage to power
 * `workflow_dispatch` between page reloads. Cleared on logout.
 */
export function getStoredGithubOauthToken(): string | null {
  try {
    return window.localStorage.getItem(GH_OAUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredGithubOauthToken(token: string): void {
  window.localStorage.setItem(GH_OAUTH_TOKEN_KEY, token);
}

export function clearStoredGithubOauthToken(): void {
  window.localStorage.removeItem(GH_OAUTH_TOKEN_KEY);
}
