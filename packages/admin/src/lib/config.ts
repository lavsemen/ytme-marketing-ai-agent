export const CONFIG = {
  repoOwner: import.meta.env.VITE_REPO_OWNER ?? '',
  repoName: import.meta.env.VITE_REPO_NAME ?? '',
  workflowFile: import.meta.env.VITE_GENERATE_WORKFLOW_FILE ?? 'generate.yml',
  landingBaseUrl: (import.meta.env.VITE_LANDING_BASE_URL ?? '').replace(/\/+$/, ''),
  sourcesPath: 'packages/agent/src/config/sources.json',
  resultsIndexPath: 'out/results/index.json',
  branch: 'main',
} as const;

export function assertRepoConfigured(): void {
  if (!CONFIG.repoOwner || !CONFIG.repoName) {
    throw new Error(
      'VITE_REPO_OWNER and VITE_REPO_NAME must be set at build time. ' +
        'Check .env.local or the deploy workflow.',
    );
  }
}
