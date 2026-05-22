import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ExternalLink } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { CONFIG } from '../lib/config';

export function LoginPage(): ReactNode {
  const { login, loading, error } = useAuth();
  const [pat, setPat] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pat) return;
    const ok = await login(pat);
    if (ok) navigate('/sources');
  };

  const fineGrainedUrl =
    CONFIG.repoOwner && CONFIG.repoName
      ? `https://github.com/settings/personal-access-tokens/new?repository=${CONFIG.repoOwner}/${CONFIG.repoName}`
      : 'https://github.com/settings/personal-access-tokens/new';
  const classicPatUrl = 'https://github.com/settings/tokens/new?scopes=repo,workflow';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-md bg-brand p-2 text-white">
            <KeyRound size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold">YouTravel Marketing AI</h1>
            <p className="text-sm text-slate-500">Войти через GitHub PAT</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pat" className="block text-sm font-medium text-slate-700">
              GitHub Personal Access Token
            </label>
            <input
              id="pat"
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="github_pat_..."
              autoComplete="off"
              spellCheck={false}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              required
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Не удалось войти: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !pat}
            className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Проверяем…' : 'Войти'}
          </button>
        </form>

        <div className="mt-6 space-y-3 rounded-md bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <div>
            <p className="mb-2 font-medium text-slate-700">Вариант A — Fine-grained PAT (рекомендуется)</p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>
                <a
                  href={fineGrainedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  Создать fine-grained token <ExternalLink size={11} />
                </a>
              </li>
              <li>Repository access: только <code>{CONFIG.repoName || 'этот репо'}</code>.</li>
              <li>
                <strong>Contents → Read and write</strong> (не Read-only).
              </li>
              <li>
                <strong>Actions → Read and write</strong> — обязательно для кнопки «Запустить генерацию».
              </li>
              <li>Metadata → Read (обычно по умолчанию).</li>
            </ol>
          </div>
          <div>
            <p className="mb-2 font-medium text-slate-700">Вариант B — Classic PAT (проще)</p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>
                <a
                  href={classicPatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  Создать classic token <ExternalLink size={11} />
                </a>
              </li>
              <li>Отметьте scopes: <code>repo</code> и <code>workflow</code>.</li>
            </ol>
          </div>
          <p>Токен хранится только в localStorage этого браузера. После смены прав — перелогиньтесь.</p>
        </div>
      </div>
    </div>
  );
}
