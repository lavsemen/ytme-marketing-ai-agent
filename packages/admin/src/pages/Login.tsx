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
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md ds-card-dark">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-md bg-lime p-2 text-bg">
            <KeyRound size={20} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-black leading-none tracking-tight text-ink-primary">
              News2<span className="text-lime">Trip</span>
            </h1>
            <p className="mt-1 text-xs text-ink-muted">Войти через GitHub PAT</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pat" className="ds-label">
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
              className="ds-input font-mono"
              required
            />
          </div>

          {error && <div className="ds-notice ds-notice-danger">Не удалось войти: {error}</div>}

          <button type="submit" disabled={loading || !pat} className="btn-primary w-full justify-center">
            {loading ? 'Проверяем…' : 'Войти'}
          </button>
        </form>

        <div className="mt-6 space-y-4 rounded-lg bg-surface-2 px-4 py-4 text-xs text-ink-secondary">
          <div>
            <p className="mb-2 text-xxs font-bold uppercase tracking-widest text-ink-muted">
              Вариант A — Fine-grained PAT (рекомендуется)
            </p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>
                <a
                  href={fineGrainedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-lime hover:underline"
                >
                  Создать fine-grained token <ExternalLink size={11} />
                </a>
              </li>
              <li>
                Repository access: только <code className="font-mono text-ink-primary">{CONFIG.repoName || 'этот репо'}</code>.
              </li>
              <li>
                <strong className="text-ink-primary">Contents → Read and write</strong> (не Read-only).
              </li>
              <li>
                <strong className="text-ink-primary">Actions → Read and write</strong> — обязательно для кнопки «Запустить генерацию».
              </li>
              <li>Metadata → Read (обычно по умолчанию).</li>
            </ol>
          </div>
          <div>
            <p className="mb-2 text-xxs font-bold uppercase tracking-widest text-ink-muted">
              Вариант B — Classic PAT (проще)
            </p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>
                <a
                  href={classicPatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-lime hover:underline"
                >
                  Создать classic token <ExternalLink size={11} />
                </a>
              </li>
              <li>
                Отметьте scopes: <code className="font-mono text-ink-primary">repo</code> и{' '}
                <code className="font-mono text-ink-primary">workflow</code>.
              </li>
            </ol>
          </div>
          <p className="text-ink-muted">
            Токен хранится только в localStorage этого браузера. После смены прав — перелогиньтесь.
          </p>
        </div>
      </div>
    </div>
  );
}
