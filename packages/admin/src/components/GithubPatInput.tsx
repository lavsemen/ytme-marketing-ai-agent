import { useState, type ReactNode } from 'react';
import { ExternalLink, KeyRound } from 'lucide-react';
import { CONFIG } from '../lib/config';

interface GithubPatInputProps {
  pat: string | null;
  onSave: (token: string) => void;
  /** Called when the user types in the field (for run-before-save UX). */
  onDraftChange?: (draft: string) => void;
  /** Compact layout for embedding in form pages (Generate, Schedules). */
  compact?: boolean;
}

export function GithubPatInput({
  pat,
  onSave,
  onDraftChange,
  compact = false,
}: GithubPatInputProps): ReactNode {
  const [patInput, setPatInput] = useState('');
  const [editing, setEditing] = useState(!pat);

  const fineGrainedUrl =
    CONFIG.repoOwner && CONFIG.repoName
      ? `https://github.com/settings/personal-access-tokens/new?repository=${CONFIG.repoOwner}/${CONFIG.repoName}`
      : 'https://github.com/settings/personal-access-tokens/new';
  const classicPatUrl = 'https://github.com/settings/tokens/new?scopes=repo,workflow';

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const token = patInput.trim();
    if (!token) return;
    onSave(token);
    setPatInput('');
    onDraftChange?.('');
    setEditing(false);
  };

  if (pat && !editing) {
    return (
      <div className="rounded-lg border border-line bg-surface-2 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-ink-secondary">
            <KeyRound size={14} className="text-lime" />
            <span>
              GitHub PAT сохранён — можно запускать workflow
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xxs font-bold uppercase tracking-widest text-ink-muted hover:text-ink-primary"
          >
            Изменить
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-line bg-surface-2 px-4 py-4">
      <div className="flex items-center gap-2">
        <KeyRound size={14} className="text-lime" />
        <p className="text-sm font-bold text-ink-primary">GitHub Personal Access Token</p>
      </div>
      <p className="text-xs text-ink-muted">
        Нужен для <code className="font-mono text-ink-secondary">workflow_dispatch</code> в GitHub Actions.
        OAuth-вход не даёт права Actions — вставьте PAT один раз, он сохранится в localStorage браузера.
      </p>
      <div>
        <label htmlFor="github-pat" className="ds-label">
          Токен
        </label>
        <input
          id="github-pat"
          type="password"
          value={patInput}
          onChange={(e) => {
            setPatInput(e.target.value);
            onDraftChange?.(e.target.value);
          }}
          placeholder="github_pat_..."
          autoComplete="off"
          spellCheck={false}
          className="ds-input font-mono"
          required
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={!patInput.trim()} className="btn-outline">
          {pat ? 'Обновить PAT' : 'Сохранить PAT'}
        </button>
        {pat && (
          <button
            type="button"
            onClick={() => {
              setPatInput('');
              onDraftChange?.('');
              setEditing(false);
            }}
            className="text-xxs font-bold uppercase tracking-widest text-ink-muted hover:text-ink-primary"
          >
            Отмена
          </button>
        )}
      </div>
      {!compact && (
        <div className="space-y-3 border-t border-line pt-3 text-xs text-ink-secondary">
          <p>
            <span className="text-xxs font-bold uppercase tracking-widest text-ink-muted">
              Fine-grained (рекомендуется):{' '}
            </span>
            <a
              href={fineGrainedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-lime hover:underline"
            >
              создать токен <ExternalLink size={11} />
            </a>
            {' — '}
            Repository → Actions: <strong className="text-ink-primary">Read and write</strong>.
          </p>
          <p>
            <span className="text-xxs font-bold uppercase tracking-widest text-ink-muted">
              Classic:{' '}
            </span>
            <a
              href={classicPatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-lime hover:underline"
            >
              создать токен <ExternalLink size={11} />
            </a>
            {' — scopes '}
            <code className="font-mono text-ink-primary">repo</code> +{' '}
            <code className="font-mono text-ink-primary">workflow</code>.
          </p>
        </div>
      )}
      {compact && (
        <p className="text-xxs text-ink-muted">
          Fine-grained: Actions → Read and write.{' '}
          <a
            href={fineGrainedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-lime hover:underline"
          >
            Создать токен <ExternalLink size={10} />
          </a>
        </p>
      )}
    </form>
  );
}

/** Returns a trimmed PAT from storage or an unsaved draft in the input field. */
export function resolveWorkflowPat(storedPat: string | null, draft: string): string | null {
  const trimmed = draft.trim();
  if (storedPat) return storedPat;
  return trimmed || null;
}
