import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ExternalLink, ArrowLeft, AlertTriangle } from 'lucide-react';
import {
  fetchResult,
  isRejectedResult,
  REJECTION_REASON_LABELS,
  type RejectedResultJson,
} from '../api/results';
import { useAuth } from '../hooks/useAuth';
import type { ReactNode } from 'react';

function RejectedView({ data }: { data: RejectedResultJson }): ReactNode {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/history" className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
          <ArrowLeft size={14} /> К истории
        </Link>
      </div>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={20} />
          <div>
            <h2 className="text-lg font-semibold text-amber-900">
              Запуск пропущен · {REJECTION_REASON_LABELS[data.reason]}
            </h2>
            <p className="mt-2 text-sm text-amber-900/90">{data.message}</p>
            <p className="mt-3 text-xs text-amber-800">
              {data.sourceId ? <>Источник: <code>{data.sourceId}</code> · </> : null}
              run-id: <code>{data.meta.runId ?? '—'}</code> ·{' '}
              {new Date(data.meta.createdAt).toLocaleString('ru-RU')}
            </p>
          </div>
        </div>
      </section>

      {data.topInsight && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Топ-инсайт LLM (отбракован)
          </h3>
          <p className="mt-2 font-medium text-slate-800">{data.topInsight.title}</p>
          <p className="mt-1 text-sm text-slate-600">{data.topInsight.shortSummary}</p>
          <p className="mt-2 text-xs text-slate-500">
            Страна: {data.topInsight.country} · уверенность{' '}
            {(data.topInsight.confidenceScore * 100).toFixed(0)}%
          </p>
          {data.topInsight.reasonWhyRelevant && (
            <p className="mt-2 text-xs text-slate-500">
              Объяснение LLM: {data.topInsight.reasonWhyRelevant}
            </p>
          )}
        </section>
      )}

      {data.newsSampled.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Полученные новости ({data.newsSampled.length})
          </h3>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {data.newsSampled.map((n) => (
              <li key={n.url} className="px-4 py-2 text-sm">
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-slate-800 hover:text-brand"
                >
                  {n.title}
                </a>
                <div className="text-xs text-slate-500">{n.sourceName}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.insights.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Все инсайты ({data.insights.length})
          </h3>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {data.insights.map((i) => (
              <li key={i.sourceUrl} className="px-4 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-800">{i.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {i.country} · {(i.confidenceScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-xs text-slate-500">{i.travelAngle}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Что можно сделать:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Запустить генерацию без фильтра <code>--source</code> — будет проанализировано больше новостей.</li>
          <li>Поменять URL источника на раздел новостей (а не главную) в настройках источников.</li>
          <li>Отключить источник, который стабильно даёт слабые инфоповоды.</li>
        </ul>
      </section>
    </div>
  );
}

export function ResultDetailPage(): ReactNode {
  const { slug } = useParams<{ slug: string }>();
  const { pat } = useAuth();
  const query = useQuery({
    queryKey: ['result', slug, pat ? 'repo' : 'pages'],
    queryFn: async () => (slug ? fetchResult(pat, slug) : null),
    enabled: !!slug,
  });

  if (!slug) return <div>Неверный slug.</div>;
  if (query.isLoading) return <div className="text-sm text-slate-500">Загружаем…</div>;

  const data = query.data;
  if (!data) {
    return (
      <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Результат не найден в репозитории. Если генерация только что завершилась — обновите через минуту.
      </div>
    );
  }

  if (isRejectedResult(data)) {
    return <RejectedView data={data} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/history" className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
          <ArrowLeft size={14} /> К истории
        </Link>
        <a
          href={data.landing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Открыть лендинг <ExternalLink size={13} />
        </a>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">{data.post.marketingTitle}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {data.insight.country}
          {data.insight.region ? ` · ${data.insight.region}` : ''} ·
          уверенность {(data.insight.confidenceScore * 100).toFixed(0)}%
        </p>
        <div className="mt-4 whitespace-pre-line text-sm text-slate-700">
          {data.post.marketingText}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Источник
          </h3>
          <p className="mt-2 font-medium text-slate-800">{data.news.title}</p>
          <p className="mt-1 text-sm text-slate-600">{data.news.summary}</p>
          <a
            href={data.news.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm text-brand hover:underline"
          >
            {data.news.sourceName} <ExternalLink size={12} />
          </a>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Travel-angle
          </h3>
          <p className="mt-2 text-sm text-slate-700">{data.insight.travelAngle}</p>
          {data.insight.seasonality && (
            <p className="mt-2 text-xs text-slate-500">Сезон: {data.insight.seasonality}</p>
          )}
          {data.insight.targetAudience && (
            <p className="mt-1 text-xs text-slate-500">Аудитория: {data.insight.targetAudience}</p>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Туры ({data.tours.length})
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.tours.map((tour) => (
            <a
              key={tour.id}
              href={tour.url}
              target="_blank"
              rel="noopener noreferrer"
              className="overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:border-brand"
            >
              {tour.imageUrl ? (
                <img src={tour.imageUrl} alt={tour.title} className="h-36 w-full object-cover" />
              ) : (
                <div className="h-36 bg-gradient-to-br from-slate-200 to-slate-300" />
              )}
              <div className="p-3">
                <p className="text-sm font-medium text-slate-800">{tour.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {tour.rating != null && <span>★ {tour.rating.toFixed(1)}</span>}
                  {tour.duration && <span>{tour.duration}</span>}
                  {tour.price && <span className="font-medium text-slate-700">{tour.price}</span>}
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Превью лендинга
        </h3>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-4">
          <iframe
            src={data.landing.url}
            title="Landing preview"
            className="mx-auto block h-[568px] w-[320px] rounded-md border border-slate-200"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </section>
    </div>
  );
}
