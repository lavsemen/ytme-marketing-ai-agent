import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import {
  fetchResultsIndex,
  REJECTION_REASON_LABELS,
  type ResultMeta,
} from '../api/results';
import { useAuth } from '../hooks/useAuth';
import type { ReactNode } from 'react';

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

export function HistoryPage(): ReactNode {
  const { pat } = useAuth();
  const query = useQuery({
    queryKey: ['results-index', pat ? 'repo' : 'pages'],
    queryFn: () => fetchResultsIndex(pat),
    refetchInterval: 30_000,
  });

  if (query.isLoading) return <div className="text-sm text-ink-muted">Загружаем историю…</div>;

  const results = query.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-3xl font-black uppercase tracking-tight text-ink-primary">
          История <span className="text-lime">генераций</span>
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Список из ветки <code className="font-mono text-ink-secondary">main</code> репозитория (актуальнее, чем кэш GitHub Pages). Превью лендингов на Pages обновляется после workflow Deploy to GitHub Pages.
        </p>
      </div>

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
    </div>
  );
}
