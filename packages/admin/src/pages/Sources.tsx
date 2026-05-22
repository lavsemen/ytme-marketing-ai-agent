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
    return <div className="text-sm text-slate-500">Загружаем источники…</div>;
  }
  if (query.isError) {
    return (
      <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        Ошибка загрузки: {(query.error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Источники новостей</h2>
          <p className="text-sm text-slate-500">
            Все правки коммитятся в <code>main</code> через GitHub API.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
        >
          <Plus size={16} /> Добавить
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2">Название</th>
              <th className="px-4 py-2">URL</th>
              <th className="px-4 py-2">Тип</th>
              <th className="px-4 py-2">Lang</th>
              <th className="px-4 py-2">Статус</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sources.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Источников пока нет. Добавьте первый.
                </td>
              </tr>
            )}
            {sources.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-medium text-slate-800">
                  {s.name}
                  <div className="text-xs text-slate-400">{s.id}</div>
                </td>
                <td className="px-4 py-2 max-w-xs truncate text-slate-600">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline"
                  >
                    {s.url}
                  </a>
                </td>
                <td className="px-4 py-2 text-slate-600">{s.type ?? 'auto'}</td>
                <td className="px-4 py-2 text-slate-600">{s.language}</td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => handleToggle(s)}
                    disabled={saveMutation.isPending}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.enabled
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {s.enabled ? <Check size={12} /> : <X size={12} />}
                    {s.enabled ? 'Включён' : 'Выключен'}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(s)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    title="Изменить"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s)}
                    disabled={saveMutation.isPending}
                    className="rounded p-1 text-red-500 hover:bg-red-50"
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
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
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
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {initial ? 'Изменить источник' : 'Новый источник'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <FormField label="ID (kebab-case)" error={errors.id?.message}>
            <input
              {...register('id')}
              disabled={!!initial}
              className="form-input"
              placeholder="lenta-travel"
            />
          </FormField>
          <FormField label="Название" error={errors.name?.message}>
            <input {...register('name')} className="form-input" placeholder="Lenta.ru" />
          </FormField>
          <FormField label="URL" error={errors.url?.message}>
            <input {...register('url')} className="form-input" placeholder="https://..." />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Тип" error={errors.type?.message}>
              <select {...register('type')} className="form-input">
                <option value="auto">auto</option>
                <option value="rss">rss</option>
                <option value="html">html</option>
              </select>
            </FormField>
            <FormField label="Язык" error={errors.language?.message}>
              <input {...register('language')} className="form-input" placeholder="ru" />
            </FormField>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('enabled')} className="rounded" />
            Включён
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {submitting ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        .form-input {
          width: 100%;
          padding: 6px 10px;
          font-size: 14px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: white;
        }
        .form-input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 1px #2563eb; }
        .form-input:disabled { background: #f1f5f9; color: #64748b; }
      `}</style>
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
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
