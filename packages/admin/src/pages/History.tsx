import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { fetchResultsIndex } from '../api/results';
import { useAuth } from '../hooks/useAuth';
import type { ReactNode } from 'react';

export function HistoryPage(): ReactNode {
  const { pat } = useAuth();
  const query = useQuery({
    queryKey: ['results-index', pat ? 'repo' : 'pages'],
    queryFn: () => fetchResultsIndex(pat),
    refetchInterval: 30_000,
  });

  if (query.isLoading) return <div className="text-sm text-slate-500">Загружаем историю…</div>;

  const results = query.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">История генераций</h2>
        <p className="text-sm text-slate-500">
          Список из ветки <code>main</code> репозитория (актуальнее, чем кэш GitHub Pages).
          Превью лендингов на Pages обновляется после workflow Deploy to GitHub Pages.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2">Дата</th>
              <th className="px-4 py-2">Новость</th>
              <th className="px-4 py-2">Страна</th>
              <th className="px-4 py-2">Туров</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Пока ничего не сгенерировано. Запустите первый pipeline.
                </td>
              </tr>
            )}
            {results.map((r) => (
              <tr key={r.slug} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-500">
                  {new Date(r.createdAt).toLocaleString('ru-RU')}
                </td>
                <td className="px-4 py-2">
                  <Link
                    to={`/results/${r.slug}`}
                    className="font-medium text-slate-800 hover:text-brand"
                  >
                    {r.newsTitle}
                  </Link>
                  <div className="text-xs text-slate-400">{r.slug}</div>
                </td>
                <td className="px-4 py-2 text-slate-600">{r.country ?? '—'}</td>
                <td className="px-4 py-2 text-slate-600">{r.toursCount}</td>
                <td className="px-4 py-2 text-right">
                  <a
                    href={r.landingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
                  >
                    Лендинг <ExternalLink size={12} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
