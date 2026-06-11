import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, RotateCcw, FileSpreadsheet } from 'lucide-react';
import { loadCatalogMeta, resetCatalogToDefault, saveCatalogCsv } from '../api/catalog';

export function CatalogPage(): ReactNode {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const query = useQuery({
    queryKey: ['catalog'],
    queryFn: () => loadCatalogMeta(),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => saveCatalogCsv(file),
    onSuccess: () => {
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
      qc.invalidateQueries({ queryKey: ['catalog'] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetCatalogToDefault(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog'] }),
  });

  const busy = uploadMutation.isPending || resetMutation.isPending;
  const meta = query.data;
  const error = query.error ?? uploadMutation.error ?? resetMutation.error;

  async function handleUpload(): Promise<void> {
    if (!selectedFile || busy) return;
    await uploadMutation.mutateAsync(selectedFile);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-black uppercase tracking-tight text-ink-primary">
          Подборки <span className="text-lime">каталога</span>
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          CSV со страницами каталога YouTravel.me. Агент использует его вместо API туров для
          матчинга подборок при генерации поста и лендинга.
        </p>
      </div>

      {error instanceof Error && (
        <div className="ds-notice ds-notice-danger">
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      <section className="ds-card space-y-4">
        <h3 className="ds-label">Загрузка CSV</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 min-w-[200px] flex-col gap-1">
            <span className="text-xxs uppercase tracking-wider text-ink-faint">Файл (.csv)</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              className="ds-input"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            disabled={!selectedFile || busy}
            onClick={() => void handleUpload()}
          >
            <Upload size={16} />
            Загрузить
          </button>
          <button
            type="button"
            className="btn-outline inline-flex items-center gap-2"
            disabled={busy}
            onClick={() => void resetMutation.mutateAsync()}
          >
            <RotateCcw size={16} />
            Сбросить к дефолту
          </button>
        </div>
      </section>

      <section className="ds-card">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-lime" />
          <h3 className="ds-label">Текущий каталог</h3>
        </div>

        {query.isLoading && <p className="mt-3 text-sm text-ink-muted">Загружаем метаданные…</p>}

        {!query.isLoading && !meta && (
          <p className="mt-3 text-sm text-ink-muted">
            В Firestore пока нет загруженного CSV. Агент использует bundled default из репозитория.
            Загрузите файл или нажмите «Сбросить к дефолту».
          </p>
        )}

        {meta && (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xxs uppercase tracking-wider text-ink-faint">Всего строк</dt>
              <dd className="font-display text-2xl font-bold text-ink-primary">{meta.rowCount}</dd>
            </div>
            <div>
              <dt className="text-xxs uppercase tracking-wider text-ink-faint">После фильтра</dt>
              <dd className="font-display text-2xl font-bold text-ink-primary">{meta.filteredCount}</dd>
            </div>
            <div>
              <dt className="text-xxs uppercase tracking-wider text-ink-faint">Файл</dt>
              <dd className="text-sm text-ink-secondary">{meta.fileName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xxs uppercase tracking-wider text-ink-faint">Обновлено</dt>
              <dd className="text-sm text-ink-secondary">
                {new Date(meta.updatedAt).toLocaleString('ru-RU')}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {meta && meta.preview.length > 0 && (
        <section className="ds-table-wrap">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-secondary">
            Превью (первые 5 строк после фильтра)
          </h3>
          <table className="ds-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Назначение</th>
                <th>Туров</th>
                <th>URL</th>
              </tr>
            </thead>
            <tbody>
              {meta.preview.map((row) => (
                <tr key={row.url}>
                  <td className="font-semibold text-ink-primary">{row.title}</td>
                  <td className="text-xs text-ink-muted">{row.purpose}</td>
                  <td className="font-mono text-xs">{row.tourCount ?? '—'}</td>
                  <td>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-lime hover:underline"
                    >
                      {row.url.replace('https://youtravel.me/', '')}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
