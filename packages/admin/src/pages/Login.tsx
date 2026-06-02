import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ExternalLink, Github, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { CONFIG } from '../lib/config';
import { getFirebaseConfigError } from '../lib/firebase';

/**
 * Login screen — single OAuth path through Firebase, with an optional PAT
 * accessory for users who want to launch workflows from the UI.
 *
 * The PAT input is hidden behind a disclosure because most users will only
 * read/edit Firestore-backed data and never need to dispatch a workflow.
 */
export function LoginPage(): ReactNode {
  const { loginWithGithubOauth, savePat, loading, error, firebaseUser, pat } = useAuth();
  const [patInput, setPatInput] = useState('');
  const [patExpanded, setPatExpanded] = useState(false);
  const navigate = useNavigate();
  const fbConfigError = getFirebaseConfigError();

  const handleOauth = async () => {
    const ok = await loginWithGithubOauth();
    if (ok) navigate('/sources');
  };

  const handlePatSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!patInput.trim()) return;
    savePat(patInput.trim());
    setPatInput('');
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
            <p className="mt-1 text-xs text-ink-muted">Войти через GitHub OAuth</p>
          </div>
        </div>

        {fbConfigError && <div className="ds-notice ds-notice-danger mb-4">{fbConfigError}</div>}

        <div className="mb-5 space-y-3">
          <button
            type="button"
            onClick={handleOauth}
            disabled={loading || !!fbConfigError}
            className="btn-primary w-full justify-center"
          >
            <Github size={16} />
            {loading ? 'Открываем GitHub…' : 'Войти через GitHub'}
          </button>
          <p className="text-xxs text-ink-muted">
            Откроется всплывающее окно GitHub. После первого входа администратор должен выдать вам доступ в
            Firebase Console → Firestore → users/{'{'}login{'}'}: admin=true.
          </p>
        </div>

        {error && <div className="ds-notice ds-notice-danger mb-4">Не удалось войти: {error}</div>}

        <div className="border-t border-line pt-5">
          <button
            type="button"
            onClick={() => setPatExpanded((v) => !v)}
            className="mb-3 inline-flex items-center gap-1 text-xxs font-bold uppercase tracking-widest text-ink-muted hover:text-ink-primary"
          >
            {patExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {pat
              ? 'PAT сохранён — изменить'
              : 'Дополнительно: задать PAT для запуска workflow'}
          </button>

          {patExpanded && (
            <form onSubmit={handlePatSubmit} className="space-y-4">
              <div>
                <label htmlFor="pat" className="ds-label">
                  GitHub Personal Access Token
                </label>
                <input
                  id="pat"
                  type="password"
                  value={patInput}
                  onChange={(e) => setPatInput(e.target.value)}
                  placeholder="github_pat_..."
                  autoComplete="off"
                  spellCheck={false}
                  className="ds-input font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!patInput.trim()}
                className="btn-outline w-full justify-center"
              >
                {pat ? 'Обновить PAT' : 'Сохранить PAT'}
              </button>

              <div className="space-y-4 rounded-lg bg-surface-2 px-4 py-4 text-xs text-ink-secondary">
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
            </form>
          )}
          {firebaseUser && (
            <p className="mt-3 text-xxs text-ink-muted">
              Вы уже вошли как <span className="font-mono text-ink-primary">{firebaseUser.email ?? firebaseUser.uid}</span>.
              Чтобы выйти — нажмите Logout в шапке.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
