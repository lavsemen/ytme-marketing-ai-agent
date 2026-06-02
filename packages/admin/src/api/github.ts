import { Octokit } from '@octokit/rest';
import { CONFIG } from '../lib/config';

/**
 * GitHub API surface used by the admin UI.
 *
 * After the Firestore migration, GitHub is only used to:
 *  - trigger workflows (generate.yml / scheduled.yml via workflow_dispatch)
 *  - poll a single run's status/jobs for the RunStatus page
 *
 * All config/data CRUD lives in Firestore (see api/sources.ts, api/schedules.ts,
 * api/prompts.ts, api/settings.ts). PAT is therefore only needed for users who
 * want to launch a workflow from the UI.
 */

/** In dev, route API calls through Vite proxy to avoid browser CORS on api.github.com. */
function githubApiBaseUrl(): string | undefined {
  if (!import.meta.env.DEV) return undefined;
  return `${window.location.origin}/api/github`;
}

export function createGithubClient(token: string): Octokit {
  const baseUrl = githubApiBaseUrl();
  return new Octokit({
    auth: token,
    userAgent: 'ytme-admin/0.1',
    ...(baseUrl ? { baseUrl } : {}),
  });
}

export async function getCurrentUser(token: string): Promise<{ login: string; avatar_url: string }> {
  const client = createGithubClient(token);
  const res = await client.users.getAuthenticated();
  return { login: res.data.login, avatar_url: res.data.avatar_url };
}

export interface PatVerification {
  user: { login: string; avatar_url: string };
  canDispatch: boolean;
  workflowFound: boolean;
  warnings: string[];
}

function isForbidden(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: number }).status === 403
  );
}

/**
 * Validates a PAT for the only scope the UI needs: dispatching
 * generate.yml. Contents permissions are no longer required since all
 * config writes go through Firestore.
 */
export async function verifyPatPermissions(token: string): Promise<PatVerification> {
  const client = createGithubClient(token);
  const user = await getCurrentUser(token);
  const warnings: string[] = [];

  let workflowFound = false;
  let canDispatch = false;
  try {
    await client.actions.getWorkflow({
      owner: CONFIG.repoOwner,
      repo: CONFIG.repoName,
      workflow_id: CONFIG.workflowFile,
    });
    workflowFound = true;
    canDispatch = true;
  } catch (err) {
    if (isForbidden(err)) {
      warnings.push(
        'Actions: нужен доступ Read and write (для запуска generate.yml через workflow_dispatch).',
      );
    } else {
      warnings.push(
        `Workflow "${CONFIG.workflowFile}" не найден. Убедитесь, что файл есть в ветке ${CONFIG.branch} на GitHub.`,
      );
    }
  }

  if (!workflowFound) {
    warnings.push(
      'Проверьте, что репозиторий запушен в main и в .github/workflows/ есть generate.yml.',
    );
  }

  return {
    user,
    canDispatch,
    workflowFound,
    warnings,
  };
}

export function formatGithubApiError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);

  if (raw.includes('Resource not accessible by personal access token')) {
    return [
      'У токена нет прав для этого действия.',
      'Fine-grained PAT: Repository permissions → Actions → Read and write.',
      'Либо создайте Classic PAT со scopes: repo + workflow.',
      'После смены токена: выйдите и войдите снова в админке.',
    ].join(' ');
  }

  if (raw.includes('Unexpected inputs provided')) {
    const m = raw.match(/Unexpected inputs provided: \[(.*?)\]/);
    const fields = m?.[1] ?? '';
    return [
      `Workflow в ветке ${CONFIG.branch} ещё не знает про input(ы): ${fields || 'см. ошибку выше'}.`,
      `GitHub валидирует workflow_dispatch по версии файла на ${CONFIG.branch}.`,
      `Закоммитьте и запушьте .github/workflows/${CONFIG.workflowFile} с новыми inputs в ${CONFIG.branch}, затем повторите запуск.`,
    ].join(' ');
  }

  if (raw.includes('Not Found') && raw.toLowerCase().includes('workflow')) {
    return `Workflow "${CONFIG.workflowFile}" не найден. Запушьте .github/workflows/generate.yml в ветку ${CONFIG.branch}.`;
  }

  return raw;
}

export interface WorkflowRunSummary {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  run_number: number;
  head_branch: string | null;
  display_title: string;
  /** Filename of the workflow (e.g. "generate.yml") — useful when merging
   *  runs from multiple workflows in the same UI. Optional for back-compat. */
  workflow_file?: string;
}

/** GitHub API "active" statuses — anything not yet finalized. */
const PENDING_STATUSES = new Set([
  'queued',
  'in_progress',
  'waiting',
  'pending',
  'requested',
]);

export function isPendingStatus(status: string): boolean {
  return PENDING_STATUSES.has(status);
}

export interface WorkflowJobSummary {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  steps: {
    name: string;
    status: string;
    conclusion: string | null;
    number: number;
  }[];
}

export async function dispatchGenerate(
  client: Octokit,
  inputs: { source?: string; hint?: string },
): Promise<void> {
  await client.actions.createWorkflowDispatch({
    owner: CONFIG.repoOwner,
    repo: CONFIG.repoName,
    workflow_id: CONFIG.workflowFile,
    ref: CONFIG.branch,
    inputs: {
      source: inputs.source ?? 'all',
      ...(inputs.hint ? { hint: inputs.hint } : {}),
    },
  });
}

export async function dispatchScheduled(
  client: Octokit,
  inputs: { force?: boolean } = {},
): Promise<void> {
  await client.actions.createWorkflowDispatch({
    owner: CONFIG.repoOwner,
    repo: CONFIG.repoName,
    workflow_id: CONFIG.scheduledWorkflowFile,
    ref: CONFIG.branch,
    inputs: {
      force: String(Boolean(inputs.force)),
    },
  });
}

export interface ListRunsOptions {
  perPage?: number;
  /** Workflow filename (e.g. "generate.yml"). Defaults to generate workflow. */
  workflowFile?: string;
  /** Filter by GitHub run status. Useful values: "in_progress", "queued",
   *  "completed". When omitted — returns runs of any status. */
  status?: string;
}

export async function listRecentRuns(
  client: Octokit,
  perPageOrOptions: number | ListRunsOptions = 10,
): Promise<WorkflowRunSummary[]> {
  // Back-compat: previous signature was (client, perPage: number).
  const opts: ListRunsOptions =
    typeof perPageOrOptions === 'number' ? { perPage: perPageOrOptions } : perPageOrOptions;
  const workflowFile = opts.workflowFile ?? CONFIG.workflowFile;
  const res = await client.actions.listWorkflowRuns({
    owner: CONFIG.repoOwner,
    repo: CONFIG.repoName,
    workflow_id: workflowFile,
    per_page: opts.perPage ?? 10,
    ...(opts.status ? { status: opts.status as 'in_progress' | 'queued' | 'completed' } : {}),
  });
  return res.data.workflow_runs.map((r) => ({
    id: r.id,
    status: r.status ?? 'unknown',
    conclusion: r.conclusion,
    html_url: r.html_url,
    created_at: r.created_at,
    run_number: r.run_number,
    head_branch: r.head_branch,
    display_title: r.display_title ?? r.name ?? '',
    workflow_file: workflowFile,
  }));
}

export async function getRun(client: Octokit, runId: number): Promise<WorkflowRunSummary> {
  const res = await client.actions.getWorkflowRun({
    owner: CONFIG.repoOwner,
    repo: CONFIG.repoName,
    run_id: runId,
  });
  const r = res.data;
  return {
    id: r.id,
    status: r.status ?? 'unknown',
    conclusion: r.conclusion,
    html_url: r.html_url,
    created_at: r.created_at,
    run_number: r.run_number,
    head_branch: r.head_branch,
    display_title: r.display_title ?? r.name ?? '',
  };
}

export async function getRunJobs(client: Octokit, runId: number): Promise<WorkflowJobSummary[]> {
  const res = await client.actions.listJobsForWorkflowRun({
    owner: CONFIG.repoOwner,
    repo: CONFIG.repoName,
    run_id: runId,
  });
  return res.data.jobs.map((j) => ({
    id: j.id,
    name: j.name,
    status: j.status,
    conclusion: j.conclusion,
    started_at: j.started_at,
    completed_at: j.completed_at,
    steps: (j.steps ?? []).map((s) => ({
      name: s.name,
      status: s.status,
      conclusion: s.conclusion,
      number: s.number,
    })),
  }));
}
