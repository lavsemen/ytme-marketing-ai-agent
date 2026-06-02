import { useEffect, useState, type ReactNode } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { Eye, MousePointerClick } from 'lucide-react';
import { refs, type MetricsDoc } from '../api/db';

interface MetricsCardProps {
  slug: string;
  tourTitleById?: Record<string, string>;
}

/** Live view of `metrics/{slug}` — total views and per-tour click counters. */
export function MetricsCard({ slug, tourTitleById }: MetricsCardProps): ReactNode {
  const [metrics, setMetrics] = useState<MetricsDoc | null>(null);
  const [exists, setExists] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onSnapshot(refs.metrics(slug), (snap) => {
      if (snap.exists()) {
        setMetrics(snap.data() ?? null);
        setExists(true);
      } else {
        setMetrics(null);
        setExists(false);
      }
    });
    return () => unsub();
  }, [slug]);

  const clicks = metrics?.clicksByTour ?? {};
  const tourEntries = Object.entries(clicks).sort((a, b) => b[1] - a[1]);

  return (
    <section className="ds-card">
      <div className="flex items-center justify-between">
        <h3 className="ds-label">Метрики лендинга</h3>
        {!exists && (
          <span className="text-xxs uppercase tracking-wider text-ink-faint">
            Пока нет данных
          </span>
        )}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-3">
          <Eye size={18} className="text-lime" />
          <div>
            <div className="text-xs text-ink-muted">Просмотры</div>
            <div className="font-display text-2xl font-bold leading-none text-ink-primary">
              {metrics?.views ?? 0}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-3">
          <MousePointerClick size={18} className="text-lime" />
          <div>
            <div className="text-xs text-ink-muted">Клики по турам</div>
            <div className="font-display text-2xl font-bold leading-none text-ink-primary">
              {tourEntries.reduce((sum, [, n]) => sum + n, 0)}
            </div>
          </div>
        </div>
      </div>
      {tourEntries.length > 0 && (
        <div className="mt-4">
          <p className="text-xxs uppercase tracking-wider text-ink-faint">
            По турам ({tourEntries.length})
          </p>
          <ul className="mt-2 divide-y divide-line-subtle">
            {tourEntries.map(([tourId, count]) => (
              <li
                key={tourId}
                className="flex items-center justify-between py-2 text-xs"
              >
                <span className="truncate text-ink-secondary">
                  {tourTitleById?.[tourId] ?? tourId}
                </span>
                <span className="font-mono font-semibold text-ink-primary">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
