import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2 } from 'lucide-react';
import { REJECTION_REASON_LABELS, type ResultMeta } from '../api/results';
import { useFirestoreHistory } from '../hooks/useFirestoreHistory';
import type { RunDoc } from '../api/db';

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

function pendingLabelFromRun(run: RunDoc): string {
  return run.trigger === 'scheduled' ? 'По расписанию' : 'Ручной запуск';
}

export function HistoryPage(): ReactNode {
  const fsHistory = useFirestoreHistory();

  if (fsHistory.loading) {
    return <div className="text-sm text-ink-muted">Загружаем историю…</div>;
  }

  const results = fsHistory.results;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-black uppercase tracking-tight text-ink-primary">
          История <span className="text-lime">генераций</span>
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Realtime-подписка через Firestore: активные и завершённые запуски обновляются мгновенно.
        </p>
      </div>

      {fsHistory.pending.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-secondary">
            Сейчас выполняются ({fsHistory.pending.length})
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
                {fsHistory.pending.map((r) => (
                  <tr key={r.runId}>
                    <td className="whitespace-nowrap font-mono text-xs text-ink-muted">
                      {new Date(r.startedAt).toLocaleString('ru-RU')}
                    </td>
                    <td>
                      <PendingBadge status={r.status} />
                    </td>
                    <td>
                      <span className="ds-badge-muted">{pendingLabelFromRun(r)}</span>
                    </td>
                    <td>
                      <span className="font-semibold text-ink-primary">
                        {r.source ?? 'all'} · {r.hint ?? '—'}
                      </span>
                      <div className="text-xxs text-ink-faint">runId: {r.runId}</div>
                    </td>
                    <td className="text-right">
                      {r.htmlUrl && (
                        <a
                          href={r.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-secondary hover:text-lime"
                        >
                          GitHub <ExternalLink size={11} />
                        </a>
                      )}
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
