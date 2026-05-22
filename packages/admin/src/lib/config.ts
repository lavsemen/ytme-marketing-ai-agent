export const CONFIG = {
  repoOwner: import.meta.env.VITE_REPO_OWNER ?? '',
  repoName: import.meta.env.VITE_REPO_NAME ?? '',
  workflowFile: import.meta.env.VITE_GENERATE_WORKFLOW_FILE ?? 'generate.yml',
  landingBaseUrl: (import.meta.env.VITE_LANDING_BASE_URL ?? '').replace(/\/+$/, ''),
  sourcesPath: 'packages/agent/src/config/sources.json',
  resultsIndexPath: 'out/results/index.json',
  branch: 'main',
} as const;

export function isRepoConfigured(): boolean {
  return Boolean(CONFIG.repoOwner && CONFIG.repoName);
}

export function repoConfigError(): string | null {
  if (isRepoConfigured()) return null;
  return (
    'Не задан репозиторий GitHub: укажите VITE_REPO_OWNER и VITE_REPO_NAME в packages/admin/.env.local ' +
    '(или в корневом .env). При yarn admin:dev owner/repo подставляются из git remote origin.'
  );
}

export function assertRepoConfigured(): void {
  const err = repoConfigError();
  if (err) throw new Error(err);
}
