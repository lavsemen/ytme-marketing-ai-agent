import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import {
  createGithubClient,
  dispatchGenerate,
  getSourcesFile,
  listRecentRuns,
} from '../api/github';
import { useAuth } from '../hooks/useAuth';

export function GeneratePage(): ReactNode {
  const { pat } = useAuth();
  const client = useMemo(() => (pat ? createGithubClient(pat) : null), [pat]);
  const navigate = useNavigate();
  const [sourceId, setSourceId] = useState<string>('all');

  const sourcesQuery = useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      if (!client) throw new Error('no client');
      return getSourcesFile(client);
    },
    enabled: !!client,
  });

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('no client');
      await dispatchGenerate(client, { source: sourceId });
      await new Promise((r) => setTimeout(r, 3000));
      const runs = await listRecentRuns(client, 5);
      return runs[0]?.id ?? null;
    },
    onSuccess: (runId) => {
      if (runId) navigate(`/runs/${runId}`);
      else navigate('/history');
    },
  });

  const sources = sourcesQuery.data?.sources ?? [];
  const enabledSources = sources.filter((s) => s.enabled);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Запустить генерацию</h2>
        <p className="text-sm text-slate-500">
          Запуск произойдёт в GitHub Actions runner'е — займёт около минуты.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <label className="block text-sm font-medium text-slate-700">
          Источник
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">Все включённые источники ({enabledSources.length})</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id} disabled={!s.enabled}>
                {s.name} {s.enabled ? '' : '(выключен)'}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-6">
          <button
            type="button"
            disabled={dispatchMutation.isPending || enabledSources.length === 0}
            onClick={() => dispatchMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play size={16} />
            {dispatchMutation.isPending ? 'Запускаем…' : 'Запустить генерацию'}
          </button>
          {enabledSources.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              Нет включённых источников. Откройте «Источники» и включите хотя бы один.
            </p>
          )}
        </div>

        {dispatchMutation.isError && (
          <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Не удалось запустить: {(dispatchMutation.error as Error).message}
          </div>
        )}
      </div>
    </div>
  );
}
