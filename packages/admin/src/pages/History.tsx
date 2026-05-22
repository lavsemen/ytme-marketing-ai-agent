import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2 } from 'lucide-react';
import {
  fetchResultsIndex,
  REJECTION_REASON_LABELS,
  type ResultMeta,
} from '../api/results';
import {
  createGithubClient,
  listAllPendingRuns,
  type WorkflowRunSummary,
} from '../api/github';
import { CONFIG } from '../lib/config';
import { useAuth } from '../hooks/useAuth';

function StatusBadge({ entry }: { entry: ResultMeta }): ReactNode {
  if (entry.status === 'rejected') {
    const label = entry.rejectionReason ? REJECTION_REASON_LABELS[entry.rejectionReason] : 'Пропущен';
    return (
      <span title={entry.rejectionMessage ?? label} className="ds-badge-warning">
        Пропущен · {label}
      </span>
    );
  }
  return <span className="ds-badge-success">Готово</span>;
}

function workflowLabel(file: string | undefined): string {
  if (!file) return 'workflow';
  if (file === CONFIG.workflowFile) return 'Ручной запуск';
  if (file === CONFIG.scheduledWorkflowFile) return 'По расписанию';
  return file;
}

function PendingBadge({ status }: { status: string }): ReactNode {
  const label =
    status === 'queued' ? 'В очереди' :
    status === 'in_progress' ? 'Выполняется' :
    status === 'waiting' ? 'Ожидание' :
    'Активно';
  return (
    <span className="ds-badge-info inline-flex items-center gap-1">
      <Loader2 size={11} className="animate-spin" />
      {label}
    </span>
  );
}

export function HistoryPage(): ReactNode {
  const { pat } = useAuth();

  // Completed runs — read from main/results-index.json (faster + works
  // without PAT via GitHub Pages fallback). 30s refresh is enough since
  // they don't change after creation.
  const completedQuery = useQuery({
    queryKey: ['results-index', pat ? 'repo' : 'pages'],
    queryFn: () => fetchResultsIndex(pat),
    refetchInterval: 30_000,
  });

  // Pending runs come from the Actions API across BOTH workflows
  // (manual + scheduled). 5s refresh keeps the UI responsive without
  // hammering the API. Requires PAT — without it we just hide the section.
  const pendingQuery = useQuery({
    queryKey: ['pending-runs'],
    queryFn: async () => {
      if (!pat) return [] as WorkflowRunSummary[];
      const client = createGithubClient(pat);
      return listAllPendingRuns(client);
    },
    enabled: !!pat,
    refetchInterval: 5_000,
    // Don't flicker the section between requests.
    refetchIntervalInBackground: false,
    staleTime: 4_000,
  });

  const visiblePending = pendingQuery.data ?? [];
  const results = completedQuery.data ?? [];

  if (completedQuery.isLoading) {
    return <div className="text-sm text-ink-muted">Загружаем историю…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-black uppercase tracking-tight text-ink-primary">
          История <span className="text-lime">генераций</span>
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Активные запуски обновляются каждые 5 секунд, завершённые — каждые 30 секунд. Список из ветки{' '}
          <code className="font-mono text-ink-secondary">main</code> репозитория.
        </p>
      </div>

      {visiblePending.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-secondary">
            Сейчас выполняются ({visiblePending.length})
          </h3>
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Запущен</th>
                  <th>Статус</th>
                  <th>Источник запуска</th>
                  <th>Описание</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visiblePending.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap font-mono text-xs text-ink-muted">
                      {new Date(r.created_at).toLocaleString('ru-RU')}
                    </td>
                    <td>
                      <PendingBadge status={r.status} />
                    </td>
                    <td>
                      <span className="ds-badge-muted">{workflowLabel(r.workflow_file)}</span>
                    </td>
                    <td>
                      <Link
                        to={`/runs/${r.id}`}
                        className="font-semibold text-ink-primary hover:text-lime"
                      >
                        {r.display_title || `Run #${r.run_number}`}
                      </Link>
                      <div className="text-xxs text-ink-faint">
                        #{r.run_number} · {r.head_branch ?? '—'}
                      </div>
                    </td>
                    <td className="text-right">
                      <a
                        href={r.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-ink-secondary hover:text-lime"
                      >
                        GitHub <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-ink-secondary">
          Завершённые ({results.length})
        </h3>
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Статус</th>
                <th>Новость</th>
                <th>Страна</th>
                <th>Туров</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-ink-muted">
                    Пока ничего не сгенерировано. Запустите первый pipeline.
                  </td>
                </tr>
              )}
              {results.map((r) => {
                const isRejected = r.status === 'rejected';
                return (
                  <tr key={r.slug}>
                    <td className="whitespace-nowrap font-mono text-xs text-ink-muted">
                      {new Date(r.createdAt).toLocaleString('ru-RU')}
                    </td>
                    <td>
                      <StatusBadge entry={r} />
                    </td>
                    <td>
                      <Link
                        to={`/results/${r.slug}`}
                        className="font-semibold text-ink-primary hover:text-lime"
                      >
                        {r.newsTitle}
                      </Link>
                      <div className="text-xs text-ink-faint">{r.slug}</div>
                    </td>
                    <td>{r.country ?? '—'}</td>
                    <td className="font-mono text-xs">{isRejected ? '—' : r.toursCount}</td>
                    <td className="text-right">
                      {isRejected ? (
                        <span className="text-xs text-ink-faint">Нет лендинга</span>
                      ) : r.landingUrl ? (
                        <a
                          href={r.landingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-lime hover:underline"
                        >
                          Лендинг <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
