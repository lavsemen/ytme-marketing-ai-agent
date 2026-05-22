import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const REPO_NAME = 'ytme-marketing-ai-agent';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const repoName = env.VITE_REPO_NAME ?? REPO_NAME;
  const base = mode === 'production' ? `/${repoName}/` : '/';

  return {
    plugins: [react()],
    base,
    server: {
      port: 5173,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
