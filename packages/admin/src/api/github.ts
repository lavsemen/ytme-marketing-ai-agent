import { Octokit } from '@octokit/rest';
import { CONFIG } from '../lib/config';

export interface SourceDto {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  language: string;
  type?: 'rss' | 'html' | 'auto';
  createdAt?: string;
  updatedAt?: string;
}

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

function decodeBase64(b64: string): string {
  const cleaned = b64.replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function encodeBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export async function getCurrentUser(token: string): Promise<{ login: string; avatar_url: string }> {
  const client = createGithubClient(token);
  const res = await client.users.getAuthenticated();
  return { login: res.data.login, avatar_url: res.data.avatar_url };
}

export interface PatVerification {
  user: { login: string; avatar_url: string };
  canReadActions: boolean;
  canWriteContents: boolean;
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

/** Validates PAT scopes needed by the admin UI (sources CRUD + workflow dispatch). */
export async function verifyPatPermissions(token: string): Promise<PatVerification> {
  const client = createGithubClient(token);
  const user = await getCurrentUser(token);
  const warnings: string[] = [];

  let canWriteContents = false;
  try {
    await client.repos.getContent({
      owner: CONFIG.repoOwner,
      repo: CONFIG.repoName,
      path: CONFIG.sourcesPath,
      ref: CONFIG.branch,
    });
    canWriteContents = true;
  } catch (err) {
    if (isForbidden(err)) {
      warnings.push('Contents: нужен доступ Read and write (для редактирования sources.json).');
    }
  }

  let workflowFound = false;
  let canReadActions = false;
  try {
    await client.actions.getWorkflow({
      owner: CONFIG.repoOwner,
      repo: CONFIG.repoName,
      workflow_id: CONFIG.workflowFile,
    });
    workflowFound = true;
    canReadActions = true;
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
    canReadActions,
    canWriteContents,
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
      'Fine-grained PAT: Repository permissions → Actions → Read and write (не только Read).',
      'Также: Contents → Read and write.',
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

export interface FileContent {
  content: string;
  sha: string;
}

export interface GetFileOptions {
  /**
   * When true, bypass HTTP / CDN / browser caches so the response reflects
   * the absolute latest commit on the branch. Required before write-with-sha
   * flows (commitJsonAtomic) — GitHub Contents API caches ~60s and would
   * otherwise hand us a stale sha after a 409 retry.
   */
  fresh?: boolean;
}

export async function getFileContent(
  client: Octokit,
  path: string,
  options: GetFileOptions = {},
): Promise<FileContent | null> {
  try {
    const res = await client.repos.getContent({
      owner: CONFIG.repoOwner,
      repo: CONFIG.repoName,
      path,
      ref: CONFIG.branch,
      ...(options.fresh
        ? {
            headers: {
              // Empty If-None-Match defeats Octokit's automatic ETag re-use,
              // so GitHub returns the freshest sha instead of a 304 backed
              // by a previously cached body (which can be up to ~60s stale).
              'If-None-Match': '',
              'Cache-Control': 'no-cache',
            },
          }
        : {}),
    });
    const data = Array.isArray(res.data) ? null : res.data;
    if (!data || data.type !== 'file') return null;
    const content = decodeBase64(data.content);
    return { content, sha: data.sha };
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export async function putFileContent(
  client: Octokit,
  args: {
    path: string;
    content: string;
    sha?: string;
    message: string;
  },
): Promise<void> {
  await client.repos.createOrUpdateFileContents({
    owner: CONFIG.repoOwner,
    repo: CONFIG.repoName,
    path: args.path,
    message: args.message,
    content: encodeBase64(args.content),
    branch: CONFIG.branch,
    ...(args.sha ? { sha: args.sha } : {}),
  });
}

function isShaConflict(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string };
  // GitHub returns 409 with a "does not match <sha>" body when the
  // provided sha is stale. Some edge cases return 422 with similar text.
  if (e.status === 409) return true;
  if (typeof e.message === 'string' && /does not match|is at|sha|stale/i.test(e.message)) {
    if (e.status === 422 || e.status === 409) return true;
  }
  return false;
}

export interface JsonCommitResult<T> {
  next: T;
  message: string;
}

const ATOMIC_MAX_ATTEMPTS = 3;
const ATOMIC_BACKOFF_MS = [150, 400];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read → mutate → commit cycle that ALWAYS fetches the latest sha right
 * before writing. This eliminates race conditions caused by:
 *  - stale react-query cache (user clicked twice before refetch finished)
 *  - parallel admin actions (two toggles in flight at once)
 *  - external commits (scheduled.yml or generate.yml landing a commit
 *    between page load and save).
 *
 * Implementation notes:
 *  - GET uses `fresh: true` so we bypass Octokit/CDN ETag cache (~60s).
 *    Without it, the second GET after a 409 can return the same stale sha
 *    and the retry would fail with an identical conflict.
 *  - On a sha-mismatch (409/422 "does not match") we retry up to
 *    ATOMIC_MAX_ATTEMPTS times with small backoff (150ms, 400ms). 3
 *    attempts comfortably absorb the typical CI race; after that we
 *    surface a clear, actionable error instead of silently looping.
 *
 * `mutator` MUST be pure with respect to the input array/object: do not
 * mutate `current` in place. Return a fresh value.
 */
export async function commitJsonAtomic<T>(
  client: Octokit,
  path: string,
  parse: (raw: string) => T,
  fallback: () => T,
  mutator: (current: T) => JsonCommitResult<T>,
): Promise<{ next: T; sha: string }> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < ATOMIC_MAX_ATTEMPTS; attempt += 1) {
    const file = await getFileContent(client, path, { fresh: true });
    const sha = file?.sha ?? null;
    const current = file ? parse(file.content) : fallback();
    const { next, message } = mutator(current);
    const content = JSON.stringify(next, null, 2) + '\n';

    try {
      await putFileContent(client, {
        path,
        content,
        message,
        ...(sha ? { sha } : {}),
      });
      // putFileContent returns void; we don't have the new sha here, but
      // callers invalidate react-query so the next read gets the truth.
      return { next, sha: sha ?? '' };
    } catch (err) {
      lastErr = err;
      if (isShaConflict(err) && attempt + 1 < ATOMIC_MAX_ATTEMPTS) {
        const delay = ATOMIC_BACKOFF_MS[attempt] ?? 400;
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  // Build a human-friendly message so the admin UI surfaces what to do
  // (instead of dumping the raw GitHub sha mismatch text on the user).
  const baseMsg =
    lastErr && typeof lastErr === 'object' && 'message' in lastErr
      ? String((lastErr as { message: string }).message)
      : 'unknown error';
  throw new Error(
    `Не удалось сохранить ${path}: репозиторий несколько раз менялся параллельно (${baseMsg}). Обновите страницу и попробуйте ещё раз.`,
  );
}

export async function getSourcesFile(
  client: Octokit,
): Promise<{ sources: SourceDto[]; sha: string | null }> {
  const file = await getFileContent(client, CONFIG.sourcesPath);
  if (!file) return { sources: [], sha: null };
  try {
    const parsed = JSON.parse(file.content) as SourceDto[];
    return { sources: parsed, sha: file.sha };
  } catch (err) {
    throw new Error(`sources.json is not valid JSON: ${(err as Error).message}`);
  }
}

export async function saveSourcesFile(
  client: Octokit,
  sources: SourceDto[],
  sha: string | null,
  commitMessage: string,
): Promise<void> {
  const json = JSON.stringify(sources, null, 2) + '\n';
  await putFileContent(client, {
    path: CONFIG.sourcesPath,
    content: json,
    ...(sha ? { sha } : {}),
    message: commitMessage,
  });
}

/**
 * Atomic update of sources.json. The mutator receives the FRESH list from
 * the repo (not from react-query cache) so it can safely de-dupe by id and
 * never overwrites someone else's commit silently.
 */
export async function applySourceChange(
  client: Octokit,
  mutator: (current: SourceDto[]) => JsonCommitResult<SourceDto[]>,
): Promise<SourceDto[]> {
  const { next } = await commitJsonAtomic<SourceDto[]>(
    client,
    CONFIG.sourcesPath,
    (raw) => {
      const parsed = JSON.parse(raw) as SourceDto[];
      if (!Array.isArray(parsed)) throw new Error('sources.json is not an array');
      return parsed;
    },
    () => [],
    mutator,
  );
  return next;
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

/**
 * Lists all pending (queued / in-progress) runs across BOTH workflows
 * (generate.yml + scheduled.yml) so the History page can show real-time
 * progress for manual *and* cron-triggered runs in a single feed.
 *
 * We query each workflow with `status` filters; "queued" and "in_progress"
 * cover the active states. GitHub doesn't accept multiple statuses in one
 * call, so we make 4 small parallel requests and de-dupe by run id.
 */
export async function listAllPendingRuns(client: Octokit): Promise<WorkflowRunSummary[]> {
  const workflows = [CONFIG.workflowFile, CONFIG.scheduledWorkflowFile];
  const statuses: Array<'queued' | 'in_progress'> = ['queued', 'in_progress'];
  const requests = workflows.flatMap((wf) =>
    statuses.map((status) =>
      listRecentRuns(client, { workflowFile: wf, status, perPage: 10 }).catch(() => [] as WorkflowRunSummary[]),
    ),
  );
  const chunks = await Promise.all(requests);
  const all = chunks.flat();
  const dedup = new Map<number, WorkflowRunSummary>();
  for (const r of all) {
    // Defensive: GitHub occasionally returns finalized runs under
    // status=in_progress right after they finish — filter again here.
    if (!isPendingStatus(r.status)) continue;
    dedup.set(r.id, r);
  }
  return Array.from(dedup.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
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
