import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ADMIN_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(ADMIN_DIR, '../..');
const DEFAULT_REPO_NAME = 'ytme-marketing-ai-agent';

function readGitRemote(): { owner: string; repo: string } | null {
  try {
    const url = execSync('git remote get-url origin', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (!match) return null;
    return { owner: match[1]!, repo: match[2]!.replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

function resolveAdminEnv(mode: string) {
  const fromRoot = loadEnv(mode, REPO_ROOT, '');
  const fromAdmin = loadEnv(mode, ADMIN_DIR, '');
  const git = readGitRemote();

  const pick = (key: string, fallback = ''): string =>
    fromAdmin[key] || fromRoot[key] || fallback;

  const repoOwner = pick('VITE_REPO_OWNER', git?.owner ?? '');
  const repoName = pick('VITE_REPO_NAME', git?.repo ?? DEFAULT_REPO_NAME);
  const workflowFile = pick('VITE_GENERATE_WORKFLOW_FILE', 'generate.yml');
  const landingBaseUrl =
    pick('VITE_LANDING_BASE_URL') ||
    (repoOwner && repoName ? `https://${repoOwner}.github.io/${repoName}` : '');

  return { repoOwner, repoName, workflowFile, landingBaseUrl };
}

export default defineConfig(({ mode }) => {
  const env = resolveAdminEnv(mode);
  const repoName = env.repoName || DEFAULT_REPO_NAME;
  const base = mode === 'production' ? `/${repoName}/` : '/';

  return {
    plugins: [react()],
    base,
    envDir: ADMIN_DIR,
    define: {
      'import.meta.env.VITE_REPO_OWNER': JSON.stringify(env.repoOwner),
      'import.meta.env.VITE_REPO_NAME': JSON.stringify(env.repoName),
      'import.meta.env.VITE_GENERATE_WORKFLOW_FILE': JSON.stringify(env.workflowFile),
      'import.meta.env.VITE_LANDING_BASE_URL': JSON.stringify(env.landingBaseUrl),
    },
    server: {
      port: 5173,
      proxy: {
        '/api/github': {
          target: 'https://api.github.com',
          changeOrigin: true,
          secure: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api\/github/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
