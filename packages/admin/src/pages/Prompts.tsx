import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save, AlertTriangle } from 'lucide-react';
import {
  DEFAULT_PROMPTS,
  loadPromptsFromRepo,
  savePromptsAtomic,
  type PromptKey,
  type PromptsDto,
  PROMPT_HINTS,
  PROMPT_KEYS,
  PROMPT_LABELS,
} from '../api/prompts';
import { useAuth } from '../hooks/useAuth';
import { formatGithubApiError } from '../api/github';

const PLACEHOLDER_HELP = [
  '{{brand.name}}, {{brand.voice}}, {{brand.defaultAudience}}',
  '{{geo.blocked}}, {{geo.prioritized}}',
  '{{hint}} — уточнение, переданное на старте генерации',
];

export function PromptsPage(): ReactNode {
  const { pat } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['prompts'],
    queryFn: async () => {
      if (!pat) throw new Error('no token');
      return loadPromptsFromRepo(pat);
    },
    enabled: !!pat,
  });

  const [draft, setDraft] = useState<PromptsDto | null>(null);

  useEffect(() => {
    if (query.data) setDraft(query.data.prompts);
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: async (args: { prompts: PromptsDto; message: string }) => {
      if (!pat) throw new Error('no token');
      // Atomic save always refetches the current sha right before commit,
      // so concurrent edits or external commits don't 409.
      await savePromptsAtomic(pat, args.prompts, args.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prompts'] }),
    onError: () => qc.invalidateQueries({ queryKey: ['prompts'] }),
  });

  const dirty = useMemo(() => {
    if (!query.data || !draft) return false;
    return PROMPT_KEYS.some((k) => draft[k] !== query.data!.prompts[k]);
  }, [draft, query.data]);

  if (!pat) {
    return <Notice tone="warn">Нужен PAT с правом Contents: Read and write.</Notice>;
  }
  if (query.isLoading) return <div className="text-sm text-ink-muted">Загружаем промпты…</div>;
  if (query.isError) {
    return <Notice tone="error">Ошибка: {formatGithubApiError(query.error)}</Notice>;
  }
  if (!draft) return null;

  function updatePrompt(key: PromptKey, value: string): void {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function resetField(key: PromptKey): void {
    setDraft((prev) => (prev ? { ...prev, [key]: DEFAULT_PROMPTS[key] } : prev));
  }

  function resetAll(): void {
    setDraft({ ...DEFAULT_PROMPTS });
  }

  async function handleSave(): Promise<void> {
    if (!query.data || !draft) return;
    await saveMutation.mutateAsync({
      prompts: draft,
      message: 'admin: update agent prompts',
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-ink-primary">
            <span className="text-lime">Промпты</span> LLM
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Сохранение коммитит{' '}
            <code className="font-mono text-ink-secondary">packages/agent/src/config/prompts.json</code> в ветку{' '}
            <code className="font-mono text-ink-secondary">main</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetAll}
            disabled={saveMutation.isPending}
            className="btn-ghost"
          >
            <RotateCcw size={14} /> Сбросить всё
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saveMutation.isPending}
            className="btn-primary"
          >
            <Save size={14} /> {saveMutation.isPending ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>

      <Notice tone="info">
        <p className="font-bold text-ink-primary">Доступные плейсхолдеры (подставятся при каждой генерации):</p>
        <ul className="mt-1 list-disc pl-5 text-xs text-ink-secondary">
          {PLACEHOLDER_HELP.map((s) => (
            <li key={s}>
              <code className="font-mono text-info">{s}</code>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-muted">
          При запуске пайплайн автоматически приклеивает к каждому промпту блок «Контекст бренда» из настроек
          (Settings → Бренд / Гео / Сезон) и текст из поля «Уточнение» в Generate.
        </p>
      </Notice>

      {saveMutation.isError && (
        <Notice tone="error">Не удалось сохранить: {formatGithubApiError(saveMutation.error)}</Notice>
      )}

      <div className="space-y-4">
        {PROMPT_KEYS.map((key) => (
          <PromptEditor
            key={key}
            label={PROMPT_LABELS[key]}
            hint={PROMPT_HINTS[key]}
            value={draft[key]}
            isDefault={draft[key] === DEFAULT_PROMPTS[key]}
            onChange={(v) => updatePrompt(key, v)}
            onReset={() => resetField(key)}
          />
        ))}
      </div>
    </div>
  );
}

interface PromptEditorProps {
  label: string;
  hint: string;
  value: string;
  isDefault: boolean;
  onChange: (next: string) => void;
  onReset: () => void;
}

function PromptEditor({ label, hint, value, isDefault, onChange, onReset }: PromptEditorProps): ReactNode {
  return (
    <div className="ds-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-primary">{label}</h3>
          <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
        </div>
        <div className="flex items-center gap-2 text-xxs text-ink-muted">
          <span className="font-mono">{value.length} симв.</span>
          <button
            type="button"
            onClick={onReset}
            disabled={isDefault}
            className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xxs font-semibold uppercase tracking-wider text-ink-secondary transition-colors hover:bg-surface-3 hover:text-ink-primary disabled:opacity-40"
          >
            <RotateCcw size={11} /> к дефолту
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="ds-input min-h-[260px] font-mono text-[12px] leading-relaxed"
      />
    </div>
  );
}

function Notice({ tone, children }: { tone: 'info' | 'warn' | 'error'; children: ReactNode }): ReactNode {
  const cls =
    tone === 'error' ? 'ds-notice ds-notice-danger' : tone === 'warn' ? 'ds-notice ds-notice-warning' : 'ds-notice ds-notice-info';
  return (
    <div className={cls}>
      {tone !== 'info' && <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
      <div className="flex-1">{children}</div>
    </div>
  );
}
