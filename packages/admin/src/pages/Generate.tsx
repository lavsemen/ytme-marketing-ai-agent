import { useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import {
  createGithubClient,
  dispatchGenerate,
  formatGithubApiError,
  listRecentRuns,
} from '../api/github';
import { GithubPatInput, resolveWorkflowPat } from '../components/GithubPatInput';
import { loadSources } from '../api/sources';
import { useAuth } from '../hooks/useAuth';

const HINT_MAX_LENGTH = 800;

const HINT_EXAMPLES = [
  'Фокус на семейный отдых с детьми, без ночной жизни',
  'Премиум-сегмент, гастрономия и винные туры',
  'Для соло-путешественников 25–40, активный отдых',
];

export function GeneratePage(): ReactNode {
  const { pat, savePat } = useAuth();
  const navigate = useNavigate();
  const [sourceId, setSourceId] = useState<string>('all');
  const [hint, setHint] = useState<string>('');
  const [patDraft, setPatDraft] = useState('');
  const workflowPat = resolveWorkflowPat(pat, patDraft);

  const sourcesQuery = useQuery({
    queryKey: ['sources'],
    queryFn: () => loadSources(),
  });

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      const token = resolveWorkflowPat(pat, patDraft);
      if (!token) throw new Error('Укажите GitHub PAT ниже — он нужен для запуска workflow.');
      if (!pat && patDraft.trim()) savePat(patDraft.trim());
      const gh = createGithubClient(token);
      const trimmedHint = hint.trim();
      await dispatchGenerate(gh, {
        source: sourceId,
        ...(trimmedHint ? { hint: trimmedHint } : {}),
      });
      await new Promise((r) => setTimeout(r, 3000));
      const runs = await listRecentRuns(gh, 5);
      return runs[0]?.id ?? null;
    },
    onSuccess: (runId) => {
      if (runId) navigate(`/runs/${runId}`);
      else navigate('/history');
    },
  });

  const sources = sourcesQuery.data?.sources ?? [];
  const enabledSources = sources.filter((s) => s.enabled);
  const hintLength = hint.length;
  const hintTooLong = hintLength > HINT_MAX_LENGTH;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-black uppercase tracking-tight text-ink-primary">
          Запустить <span className="text-lime">генерацию</span>
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Запуск произойдёт в GitHub Actions runner'е — займёт около минуты.
        </p>
      </div>

      <div className="ds-card space-y-5">
        <div>
          <label className="ds-label">Источник</label>
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="ds-input"
          >
            <option value="all">Все включённые источники ({enabledSources.length})</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id} disabled={!s.enabled}>
                {s.name} {s.enabled ? '' : '(выключен)'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="ds-label">Уточнение для этой генерации (опционально)</label>
          <textarea
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            maxLength={HINT_MAX_LENGTH + 50}
            placeholder={HINT_EXAMPLES[0]}
            className="ds-input min-h-[100px]"
          />
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="text-ink-muted">
              Подмешивается ко всем 4 LLM-вызовам (analyzer, post, landing, factcheck) этого запуска.
            </span>
            <span className={hintTooLong ? 'font-bold text-danger' : 'font-mono text-ink-faint'}>
              {hintLength} / {HINT_MAX_LENGTH}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {HINT_EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setHint(ex)} className="ds-tag">
                {ex}
              </button>
            ))}
          </div>
        </div>

        <GithubPatInput
          pat={pat}
          onSave={(token) => {
            savePat(token);
            setPatDraft('');
          }}
          onDraftChange={setPatDraft}
          compact
        />

        <div className="pt-1">
          <button
            type="button"
            disabled={
              dispatchMutation.isPending ||
              enabledSources.length === 0 ||
              hintTooLong ||
              !workflowPat
            }
            onClick={() => dispatchMutation.mutate()}
            className="btn-primary btn-lg"
          >
            <Play size={16} />
            {dispatchMutation.isPending ? 'Запускаем…' : 'Запустить генерацию'}
          </button>
          {!workflowPat && (
            <p className="mt-3 text-sm text-warning">
              Сохраните GitHub PAT выше или вставьте его перед запуском.
            </p>
          )}
          {enabledSources.length === 0 && (
            <p className="mt-3 text-sm text-warning">
              Нет включённых источников. Откройте «Источники» и включите хотя бы один.
            </p>
          )}
        </div>

        {dispatchMutation.isError && (
          <div className="ds-notice ds-notice-danger">
            <div>
              <p className="font-bold uppercase tracking-wider text-xxs">Не удалось запустить генерацию</p>
              <p className="mt-1 text-sm">{formatGithubApiError(dispatchMutation.error)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
