import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ExternalLink, ArrowLeft, AlertTriangle } from 'lucide-react';
import {
  fetchResult,
  isRejectedResult,
  REJECTION_REASON_LABELS,
  type RejectedResultJson,
  type ResultMetaJson,
} from '../api/results';
import { MetricsCard } from '../components/MetricsCard';
import type { ReactNode } from 'react';

function MetaContext({ meta }: { meta: ResultMetaJson }): ReactNode {
  const snap = meta.settingsSnapshot;
  const hasSnap = !!snap && Object.values(snap).some((v) => v !== undefined);
  if (!meta.hint && !hasSnap) return null;
  return (
    <section className="ds-card-dark text-sm">
      <h3 className="ds-label mb-2">Контекст запуска</h3>
      {meta.hint && (
        <div className="mb-3">
          <div className="text-xxs uppercase tracking-wider text-ink-muted">Уточнение маркетолога:</div>
          <div className="mt-1 whitespace-pre-line rounded-md bg-surface-2 px-3 py-2 text-ink-primary ring-1 ring-line-subtle">
            {meta.hint}
          </div>
        </div>
      )}
      {hasSnap && snap && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-ink-secondary sm:grid-cols-4">
          {snap.brandName && (
            <div>
              <dt className="text-xxs uppercase tracking-wider text-ink-faint">Бренд</dt>
              <dd className="text-ink-primary">{snap.brandName}</dd>
            </div>
          )}
          {snap.brandVoice && (
            <div>
              <dt className="text-xxs uppercase tracking-wider text-ink-faint">Голос</dt>
              <dd className="text-ink-primary">{snap.brandVoice}</dd>
            </div>
          )}
          {snap.defaultAudience && (
            <div>
              <dt className="text-xxs uppercase tracking-wider text-ink-faint">Аудитория</dt>
              <dd className="text-ink-primary">{snap.defaultAudience}</dd>
            </div>
          )}
          {snap.confidenceThreshold !== undefined && (
            <div>
              <dt className="text-xxs uppercase tracking-wider text-ink-faint">Порог</dt>
              <dd className="font-mono text-ink-primary">{snap.confidenceThreshold}</dd>
            </div>
          )}
          {snap.model && (
            <div className="col-span-2">
              <dt className="text-xxs uppercase tracking-wider text-ink-faint">Модель</dt>
              <dd className="font-mono text-ink-primary">{snap.model}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

function RejectedView({ data }: { data: RejectedResultJson }): ReactNode {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/history" className="inline-flex items-center gap-1 text-sm text-lime hover:underline">
          <ArrowLeft size={14} /> К истории
        </Link>
      </div>

      <section className="ds-notice ds-notice-warning">
        <AlertTriangle className="mt-0.5 shrink-0" size={20} />
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-tight text-warning">
            Запуск пропущен · {REJECTION_REASON_LABELS[data.reason]}
          </h2>
          <p className="mt-2 text-sm text-warning/90">{data.message}</p>
          <p className="mt-3 text-xxs text-ink-muted">
            {data.sourceId ? (
              <>
                Источник: <code className="font-mono text-ink-secondary">{data.sourceId}</code> ·{' '}
              </>
            ) : null}
            run-id: <code className="font-mono text-ink-secondary">{data.meta.runId ?? '—'}</code> ·{' '}
            {new Date(data.meta.createdAt).toLocaleString('ru-RU')}
          </p>
        </div>
      </section>

      <MetaContext meta={data.meta} />

      {data.topInsight && (
        <section className="ds-card">
          <h3 className="ds-label">Топ-инсайт LLM (отбракован)</h3>
          <p className="mt-2 font-semibold text-ink-primary">{data.topInsight.title}</p>
          <p className="mt-1 text-sm text-ink-secondary">{data.topInsight.shortSummary}</p>
          <p className="mt-2 text-xs text-ink-muted">
            Страна: {data.topInsight.country} · уверенность {(data.topInsight.confidenceScore * 100).toFixed(0)}%
          </p>
          {data.topInsight.reasonWhyRelevant && (
            <p className="mt-2 text-xs text-ink-muted">Объяснение LLM: {data.topInsight.reasonWhyRelevant}</p>
          )}
        </section>
      )}

      {data.newsSampled.length > 0 && (
        <section>
          <h3 className="ds-label mb-3">Полученные новости ({data.newsSampled.length})</h3>
          <ul className="divide-y divide-line-subtle ds-card-dark p-0 overflow-hidden">
            {data.newsSampled.map((n) => (
              <li key={n.url} className="px-4 py-3 text-sm">
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ink-primary hover:text-lime"
                >
                  {n.title}
                </a>
                <div className="text-xs text-ink-muted">{n.sourceName}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.insights.length > 0 && (
        <section>
          <h3 className="ds-label mb-3">Все инсайты ({data.insights.length})</h3>
          <ul className="divide-y divide-line-subtle ds-card-dark p-0 overflow-hidden">
            {data.insights.map((i) => (
              <li key={i.sourceUrl} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink-primary">{i.title}</span>
                  <span className="shrink-0 text-xxs font-mono text-ink-muted">
                    {i.country} · {(i.confidenceScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-xs text-ink-muted">{i.travelAngle}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="ds-card-dark text-sm text-ink-secondary">
        <p className="font-semibold text-ink-primary">Что можно сделать:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Запустить генерацию без фильтра <code className="font-mono text-ink-primary">--source</code> — будет проанализировано больше новостей.
          </li>
          <li>Поменять URL источника на раздел новостей (а не главную) в настройках источников.</li>
          <li>Отключить источник, который стабильно даёт слабые инфоповоды.</li>
        </ul>
      </section>
    </div>
  );
}

export function ResultDetailPage(): ReactNode {
  const { slug } = useParams<{ slug: string }>();
  const query = useQuery({
    queryKey: ['result', slug],
    queryFn: () => (slug ? fetchResult(slug) : null),
    enabled: !!slug,
  });

  if (!slug) return <div className="text-sm text-ink-muted">Неверный slug.</div>;
  if (query.isLoading) return <div className="text-sm text-ink-muted">Загружаем…</div>;

  const data = query.data;
  if (!data) {
    return (
      <div className="ds-notice ds-notice-warning">
        Результат не найден в Firestore. Если генерация только что завершилась — обновите через минуту.
      </div>
    );
  }

  if (isRejectedResult(data)) {
    return <RejectedView data={data} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/history" className="inline-flex items-center gap-1 text-sm text-lime hover:underline">
          <ArrowLeft size={14} /> К истории
        </Link>
        <a href={data.landing.url} target="_blank" rel="noopener noreferrer" className="btn-primary">
          Открыть лендинг <ExternalLink size={13} />
        </a>
      </div>

      <section className="ds-card-featured">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-ink-primary">
          {data.post.marketingTitle}
        </h2>
        <p className="mt-1 text-xs uppercase tracking-wider text-ink-muted">
          {data.insight.country}
          {data.insight.region ? ` · ${data.insight.region}` : ''} · уверенность {(data.insight.confidenceScore * 100).toFixed(0)}%
        </p>
        <div className="mt-4 whitespace-pre-line text-sm text-ink-secondary">{data.post.marketingText}</div>
      </section>

      <MetaContext meta={data.meta} />

      <MetricsCard
        slug={data.landing.slug}
        collectionTitleById={Object.fromEntries(
          data.collections.map((c) => [
            c.url.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 80),
            c.title,
          ]),
        )}
      />

      <section className="grid gap-6 md:grid-cols-2">
        <div className="ds-card">
          <h3 className="ds-label">Источник</h3>
          <p className="mt-2 font-semibold text-ink-primary">{data.news.title}</p>
          <p className="mt-1 text-sm text-ink-secondary">{data.news.summary}</p>
          <a
            href={data.news.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-lime hover:underline"
          >
            {data.news.sourceName} <ExternalLink size={12} />
          </a>
        </div>
        <div className="ds-card">
          <h3 className="ds-label">Travel-angle</h3>
          <p className="mt-2 text-sm text-ink-secondary">{data.insight.travelAngle}</p>
          {data.insight.seasonality && (
            <p className="mt-2 text-xs text-ink-muted">Сезон: {data.insight.seasonality}</p>
          )}
          {data.insight.targetAudience && (
            <p className="mt-1 text-xs text-ink-muted">Аудитория: {data.insight.targetAudience}</p>
          )}
        </div>
      </section>

      <section>
        <h3 className="ds-label mb-3">
          Подборки ({data.collections.length})
          {data.primaryCollection && (
            <span className="ml-2 text-xs font-normal normal-case text-ink-muted">
              CTA:{' '}
              <a
                href={data.primaryCollection.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime hover:underline"
              >
                {data.primaryCollection.title}
              </a>
            </span>
          )}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.collections.map((page) => (
            <a
              key={page.url}
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
              className="overflow-hidden rounded-xl bg-surface-2 border border-line-subtle transition-all duration-200 hover:border-line-lime hover:-translate-y-0.5 hover:shadow-lime-glow"
            >
              <div className="h-24 bg-gradient-to-br from-surface-3 to-surface-4" />
              <div className="p-3">
                <p className="text-sm font-semibold text-ink-primary">{page.title}</p>
                <p className="mt-1 text-xs text-ink-muted">{page.purpose}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  {page.tourCount != null && (
                    <span className="font-semibold text-ink-primary">{page.tourCount} туров</span>
                  )}
                  <span>{page.pageType}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section>
        <h3 className="ds-label mb-3">Превью лендинга</h3>
        <div className="overflow-hidden rounded-xl bg-surface-2 border border-line-subtle p-4">
          <iframe
            src={data.landing.url}
            title="Landing preview"
            className="mx-auto block h-[568px] w-[320px] rounded-md border border-line"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </section>
    </div>
  );
}
