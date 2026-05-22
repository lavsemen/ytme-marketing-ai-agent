import { useMemo, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { createGithubClient, getRun, getRunJobs } from '../api/github';
import { useAuth } from '../hooks/useAuth';

function statusIcon(status: string, conclusion: string | null): ReactNode {
  if (status === 'completed') {
    if (conclusion === 'success') return <CheckCircle2 className="text-success" size={16} />;
    if (conclusion === 'failure') return <XCircle className="text-danger" size={16} />;
    return <XCircle className="text-ink-faint" size={16} />;
  }
  if (status === 'in_progress') return <Loader2 className="animate-spin text-lime" size={16} />;
  return <Clock className="text-ink-faint" size={16} />;
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

  if (!id) return <div className="text-sm text-ink-muted">Неверный id запуска.</div>;
  if (runQuery.isLoading) return <div className="text-sm text-ink-muted">Загружаем статус…</div>;
  if (runQuery.isError) {
    return <div className="ds-notice ds-notice-danger">Ошибка: {(runQuery.error as Error).message}</div>;
  }

  const run = runQuery.data;
  if (!run) return null;
  const completed = run.status === 'completed';
  const success = run.conclusion === 'success';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-ink-primary">
            Запуск <span className="text-lime">#{run.run_number}</span>
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{run.display_title}</p>
        </div>
        <a
          href={run.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline btn-sm"
        >
          Открыть в GitHub <ExternalLink size={13} />
        </a>
      </div>

      <div className="ds-card">
        <div className="mb-4 flex items-center gap-2 text-sm">
          {statusIcon(run.status, run.conclusion)}
          <span className="font-semibold uppercase tracking-wider text-xxs text-ink-primary">
            {run.status}
            {run.conclusion ? ` / ${run.conclusion}` : ''}
          </span>
          <span className="text-xs text-ink-faint">
            создан {new Date(run.created_at).toLocaleString('ru-RU')}
          </span>
        </div>

        {jobsQuery.data && jobsQuery.data.length > 0 ? (
          <div className="space-y-3">
            {jobsQuery.data.map((job) => (
              <div key={job.id} className="rounded-lg border border-line-subtle bg-surface-1 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-line-subtle bg-surface-2 px-4 py-2.5 text-sm font-semibold text-ink-primary">
                  {statusIcon(job.status, job.conclusion)}
                  {job.name}
                </div>
                <ul className="divide-y divide-line-subtle text-sm">
                  {job.steps.map((step) => (
                    <li key={step.number} className="flex items-center gap-2 px-4 py-2">
                      {statusIcon(step.status, step.conclusion)}
                      <span className="flex-1 text-ink-secondary">{step.name}</span>
                      <span className="font-mono text-xxs text-ink-faint">
                        {step.conclusion ?? step.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-ink-muted">Ждём шаги…</div>
        )}
      </div>

      {completed && success && (
        <div className="ds-notice ds-notice-success">
          <div>
            Workflow завершился. Через минуту проверьте{' '}
            <Link to="/history" className="font-bold underline">
              историю
            </Link>{' '}
            — наверху появится новый результат (статус «Готово») либо запись «Пропущен», если инфоповод не прошёл порог релевантности.
          </div>
        </div>
      )}
      {completed && !success && (
        <div className="ds-notice ds-notice-danger">
          Запуск завершился с ошибкой. Откройте логи в GitHub для деталей.
        </div>
      )}
    </div>
  );
}
