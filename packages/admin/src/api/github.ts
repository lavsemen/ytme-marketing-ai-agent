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

  if (raw.includes('Not Found') && raw.toLowerCase().includes('workflow')) {
    return `Workflow "${CONFIG.workflowFile}" не найден. Запушьте .github/workflows/generate.yml в ветку ${CONFIG.branch}.`;
  }

  return raw;
}

export interface FileContent {
  content: string;
  sha: string;
}

export async function getFileContent(client: Octokit, path: string): Promise<FileContent | null> {
  try {
    const res = await client.repos.getContent({
      owner: CONFIG.repoOwner,
      repo: CONFIG.repoName,
      path,
      ref: CONFIG.branch,
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

export interface WorkflowRunSummary {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  run_number: number;
  head_branch: string | null;
  display_title: string;
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
  inputs: { source?: string },
): Promise<void> {
  await client.actions.createWorkflowDispatch({
    owner: CONFIG.repoOwner,
    repo: CONFIG.repoName,
    workflow_id: CONFIG.workflowFile,
    ref: CONFIG.branch,
    inputs: { source: inputs.source ?? 'all' },
  });
}

export async function listRecentRuns(
  client: Octokit,
  perPage = 10,
): Promise<WorkflowRunSummary[]> {
  const res = await client.actions.listWorkflowRuns({
    owner: CONFIG.repoOwner,
    repo: CONFIG.repoName,
    workflow_id: CONFIG.workflowFile,
    per_page: perPage,
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
