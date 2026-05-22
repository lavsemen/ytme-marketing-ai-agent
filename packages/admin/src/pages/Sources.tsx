import { useState, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  createGithubClient,
  getSourcesFile,
  saveSourcesFile,
  type SourceDto,
} from '../api/github';
import { useAuth } from '../hooks/useAuth';

const SourceFormSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'kebab-case latin only'),
  name: z.string().min(1),
  url: z.string().url(),
  enabled: z.boolean(),
  language: z.string().min(2).max(5),
  type: z.enum(['rss', 'html', 'auto']),
});

type SourceFormValues = z.infer<typeof SourceFormSchema>;

const DEFAULT_VALUES: SourceFormValues = {
  id: '',
  name: '',
  url: '',
  enabled: true,
  language: 'ru',
  type: 'auto',
};

export function SourcesPage(): ReactNode {
  const { pat } = useAuth();
  const client = useMemo(() => (pat ? createGithubClient(pat) : null), [pat]);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      if (!client) throw new Error('no client');
      return getSourcesFile(client);
    },
    enabled: !!client,
  });

  const saveMutation = useMutation({
    mutationFn: async (args: {
      sources: SourceDto[];
      sha: string | null;
      message: string;
    }) => {
      if (!client) throw new Error('no client');
      await saveSourcesFile(client, args.sources, args.sha, args.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources'] }),
  });

  const [editing, setEditing] = useState<SourceDto | null>(null);
  const [showForm, setShowForm] = useState(false);

  const sources = query.data?.sources ?? [];
  const sha = query.data?.sha ?? null;

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(s: SourceDto) {
    setEditing(s);
    setShowForm(true);
  }

  async function handleSave(values: SourceFormValues) {
    const now = new Date().toISOString();
    const next: SourceDto[] = editing
      ? sources.map((s) =>
          s.id === editing.id ? { ...values, createdAt: s.createdAt ?? now, updatedAt: now } : s,
        )
      : [...sources, { ...values, createdAt: now, updatedAt: now }];

    if (!editing && sources.some((s) => s.id === values.id)) {
      throw new Error(`Source with id "${values.id}" already exists`);
    }

    await saveMutation.mutateAsync({
      sources: next,
      sha,
      message: editing
        ? `admin: update source "${values.id}"`
        : `admin: add source "${values.id}"`,
    });
    setShowForm(false);
    setEditing(null);
  }

  async function handleDelete(s: SourceDto) {
    if (!confirm(`Удалить источник "${s.name}"?`)) return;
    const next = sources.filter((x) => x.id !== s.id);
    await saveMutation.mutateAsync({
      sources: next,
      sha,
      message: `admin: remove source "${s.id}"`,
    });
  }

  async function handleToggle(s: SourceDto) {
    const next = sources.map((x) =>
      x.id === s.id ? { ...x, enabled: !x.enabled, updatedAt: new Date().toISOString() } : x,
    );
    await saveMutation.mutateAsync({
      sources: next,
      sha,
      message: `admin: ${s.enabled ? 'disable' : 'enable'} "${s.id}"`,
    });
  }

  if (query.isLoading) {
    return <div className="text-sm text-ink-muted">Загружаем источники…</div>;
  }
  if (query.isError) {
    return (
      <div className="ds-notice ds-notice-danger">
        Ошибка загрузки: {(query.error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-ink-primary">
            Источники <span className="text-lime">новостей</span>
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Все правки коммитятся в <code className="font-mono text-ink-secondary">main</code> через GitHub API.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Добавить
        </button>
      </div>

      <div className="ds-table-wrap">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Название</th>
              <th>URL</th>
              <th>Тип</th>
              <th>Lang</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-ink-muted">
                  Источников пока нет. Добавьте первый.
                </td>
              </tr>
            )}
            {sources.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="font-semibold text-ink-primary">{s.name}</div>
                  <div className="text-xs text-ink-faint">{s.id}</div>
                </td>
                <td className="max-w-xs truncate">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lime hover:underline"
                  >
                    {s.url}
                  </a>
                </td>
                <td>
                  <span className="font-mono text-xs text-ink-secondary">{s.type ?? 'auto'}</span>
                </td>
                <td>
                  <span className="font-mono text-xs text-ink-secondary">{s.language}</span>
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleToggle(s)}
                    disabled={saveMutation.isPending}
                    className={s.enabled ? 'ds-badge-success' : 'ds-badge-muted'}
                  >
                    {s.enabled ? <Check size={12} /> : <X size={12} />}
                    {s.enabled ? 'Включён' : 'Выключен'}
                  </button>
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(s)}
                    className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink-primary"
                    title="Изменить"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s)}
                    disabled={saveMutation.isPending}
                    className="ml-1 rounded-md p-1.5 text-danger transition-colors hover:bg-danger/10"
                    title="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <SourceFormDialog
          initial={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
          submitting={saveMutation.isPending}
        />
      )}

      {saveMutation.isError && (
        <div className="ds-notice ds-notice-danger">
          Не удалось сохранить: {(saveMutation.error as Error).message}
        </div>
      )}
    </div>
  );
}

interface DialogProps {
  initial: SourceDto | null;
  onClose: () => void;
  onSave: (values: SourceFormValues) => Promise<void>;
  submitting: boolean;
}

function SourceFormDialog({ initial, onClose, onSave, submitting }: DialogProps): ReactNode {
  const initialValues: SourceFormValues = initial
    ? {
        id: initial.id,
        name: initial.name,
        url: initial.url,
        enabled: initial.enabled,
        language: initial.language,
        type: initial.type ?? 'auto',
      }
    : DEFAULT_VALUES;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<SourceFormValues>({ defaultValues: initialValues });

  const onSubmit = async (raw: SourceFormValues) => {
    const parsed = SourceFormSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof SourceFormValues | undefined;
        if (key) setError(key, { message: issue.message });
      }
      return;
    }
    try {
      await onSave(parsed.data);
    } catch (err) {
      setError('id', { message: (err as Error).message });
    }
  };

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md ds-card-dark border border-line">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold uppercase tracking-tight text-ink-primary">
            {initial ? 'Изменить источник' : 'Новый источник'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink-primary"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="ID (kebab-case)" error={errors.id?.message}>
            <input
              {...register('id')}
              disabled={!!initial}
              className="ds-input font-mono"
              placeholder="lenta-travel"
            />
          </FormField>
          <FormField label="Название" error={errors.name?.message}>
            <input {...register('name')} className="ds-input" placeholder="Lenta.ru" />
          </FormField>
          <FormField label="URL" error={errors.url?.message}>
            <input {...register('url')} className="ds-input" placeholder="https://..." />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Тип" error={errors.type?.message}>
              <select {...register('type')} className="ds-input">
                <option value="auto">auto</option>
                <option value="rss">rss</option>
                <option value="html">html</option>
              </select>
            </FormField>
            <FormField label="Язык" error={errors.language?.message}>
              <input {...register('language')} className="ds-input" placeholder="ru" />
            </FormField>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-ink-secondary">
            <input type="checkbox" {...register('enabled')} className="h-4 w-4 accent-lime" />
            Включён
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Отмена
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <label className="block">
      <span className="ds-label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
