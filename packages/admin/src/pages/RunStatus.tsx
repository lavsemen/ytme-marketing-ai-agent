import { useMemo, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { createGithubClient, getRun, getRunJobs } from '../api/github';
import { useAuth } from '../hooks/useAuth';

function statusIcon(status: string, conclusion: string | null): ReactNode {
  if (status === 'completed') {
    if (conclusion === 'success') return <CheckCircle2 className="text-emerald-500" size={16} />;
    if (conclusion === 'failure') return <XCircle className="text-red-500" size={16} />;
    return <XCircle className="text-slate-400" size={16} />;
  }
  if (status === 'in_progress') return <Loader2 className="animate-spin text-brand" size={16} />;
  return <Clock className="text-slate-400" size={16} />;
}

export function RunStatusPage(): ReactNode {
  const { runId } = useParams<{ runId: string }>();
  const id = runId ? Number(runId) : null;
  const { pat } = useAuth();
  const client = useMemo(() => (pat ? createGithubClient(pat) : null), [pat]);

  const runQuery = useQuery({
    queryKey: ['run', id],
    queryFn: async () => {
      if (!client || !id) throw new Error('no client');
      return getRun(client, id);
    },
    enabled: !!client && !!id,
    refetchInterval: (q) => {
      const data = q.state.data;
      return data && data.status === 'completed' ? false : 5000;
    },
  });

  const jobsQuery = useQuery({
    queryKey: ['run-jobs', id],
    queryFn: async () => {
      if (!client || !id) throw new Error('no client');
      return getRunJobs(client, id);
    },
    enabled: !!client && !!id,
    refetchInterval: (q) => {
      const data = q.state.data;
      const allDone = data?.every((j) => j.status === 'completed');
      return allDone ? false : 5000;
    },
  });

  if (!id) return <div>Неверный id запуска.</div>;
  if (runQuery.isLoading) return <div className="text-sm text-slate-500">Загружаем статус…</div>;
  if (runQuery.isError) {
    return (
      <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        Ошибка: {(runQuery.error as Error).message}
      </div>
    );
  }

  const run = runQuery.data;
  if (!run) return null;
  const completed = run.status === 'completed';
  const success = run.conclusion === 'success';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Запуск #{run.run_number}</h2>
          <p className="text-sm text-slate-500">{run.display_title}</p>
        </div>
        <a
          href={run.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
        >
          Открыть в GitHub <ExternalLink size={13} />
        </a>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm">
          {statusIcon(run.status, run.conclusion)}
          <span className="font-medium">
            {run.status}
            {run.conclusion ? ` / ${run.conclusion}` : ''}
          </span>
          <span className="text-slate-400">
            создан {new Date(run.created_at).toLocaleString('ru-RU')}
          </span>
        </div>

        {jobsQuery.data && jobsQuery.data.length > 0 ? (
          <div className="space-y-3">
            {jobsQuery.data.map((job) => (
              <div key={job.id} className="rounded-md border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm font-medium">
                  {statusIcon(job.status, job.conclusion)}
                  {job.name}
                </div>
                <ul className="divide-y divide-slate-100 text-sm">
                  {job.steps.map((step) => (
                    <li key={step.number} className="flex items-center gap-2 px-3 py-1.5">
                      {statusIcon(step.status, step.conclusion)}
                      <span className="flex-1 text-slate-700">{step.name}</span>
                      <span className="text-xs text-slate-400">
                        {step.conclusion ?? step.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">Ждём шаги…</div>
        )}
      </div>

      {completed && success && (
        <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Готово! Артефакт деплоится во второй workflow. Через минуту проверьте{' '}
          <Link to="/history" className="font-medium underline">
            историю
          </Link>{' '}
          — новый результат появится наверху.
        </div>
      )}
      {completed && !success && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          Запуск завершился с ошибкой. Откройте логи в GitHub для деталей.
        </div>
      )}
    </div>
  );
}
