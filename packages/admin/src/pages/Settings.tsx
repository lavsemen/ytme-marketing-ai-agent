import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save, AlertTriangle } from 'lucide-react';
import {
  AUDIENCE_LABELS,
  BRAND_AUDIENCES,
  BRAND_VOICES,
  DEFAULT_SETTINGS,
  MONTH_RANGE_KEYS,
  MONTH_RANGE_LABELS,
  VOICE_LABELS,
  loadSettingsFromRepo,
  saveSettingsToRepo,
  type AgentSettingsDto,
  type BrandAudience,
  type BrandVoice,
  type MonthRangeKey,
} from '../api/settings';
import { useAuth } from '../hooks/useAuth';
import { formatGithubApiError } from '../api/github';

type TabId = 'pipeline' | 'llm' | 'brand' | 'geo' | 'season' | 'tours';

const TABS: { id: TabId; label: string }[] = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'llm', label: 'LLM' },
  { id: 'brand', label: 'Бренд' },
  { id: 'geo', label: 'Гео' },
  { id: 'season', label: 'Сезон' },
  { id: 'tours', label: 'Туры' },
];

export function SettingsPage(): ReactNode {
  const { pat } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      if (!pat) throw new Error('no token');
      return loadSettingsFromRepo(pat);
    },
    enabled: !!pat,
  });

  const [draft, setDraft] = useState<AgentSettingsDto | null>(null);
  const [tab, setTab] = useState<TabId>('pipeline');

  useEffect(() => {
    if (query.data) setDraft(query.data.settings);
  }, [query.data]);

  const dirty = useMemo(() => {
    if (!query.data || !draft) return false;
    return JSON.stringify(draft) !== JSON.stringify(query.data.settings);
  }, [draft, query.data]);

  const saveMutation = useMutation({
    mutationFn: async (args: { settings: AgentSettingsDto; sha: string | null; message: string }) => {
      if (!pat) throw new Error('no token');
      await saveSettingsToRepo(pat, args.settings, args.sha, args.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  if (!pat) return <Notice tone="warn">Нужен PAT с правом Contents: Read and write.</Notice>;
  if (query.isLoading) return <div className="text-sm text-ink-muted">Загружаем настройки…</div>;
  if (query.isError) return <Notice tone="error">Ошибка: {formatGithubApiError(query.error)}</Notice>;
  if (!draft) return null;

  function resetTab(): void {
    if (!draft) return;
    const next = { ...draft } as AgentSettingsDto;
    switch (tab) {
      case 'pipeline':
        next.pipeline = { ...DEFAULT_SETTINGS.pipeline };
        break;
      case 'llm':
        next.llm = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.llm)) as AgentSettingsDto['llm'];
        break;
      case 'brand':
        next.brand = { ...DEFAULT_SETTINGS.brand, bannedWords: [], requiredHashtags: [] };
        break;
      case 'geo':
        next.geo = { ...DEFAULT_SETTINGS.geo, prioritized: [], blocked: [] };
        break;
      case 'season':
        next.seasonalPriorities = JSON.parse(
          JSON.stringify(DEFAULT_SETTINGS.seasonalPriorities),
        ) as AgentSettingsDto['seasonalPriorities'];
        break;
      case 'tours':
        next.tourFilters = { ...DEFAULT_SETTINGS.tourFilters };
        break;
    }
    setDraft(next);
  }

  async function handleSave(): Promise<void> {
    if (!query.data || !draft) return;
    await saveMutation.mutateAsync({
      settings: draft,
      sha: query.data.sha,
      message: 'admin: update agent settings',
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-ink-primary">
            <span className="text-lime">Настройки</span> агента
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Параметры пайплайна, LLM, бренда и фильтров. Коммитятся в{' '}
            <code className="font-mono text-ink-secondary">packages/agent/src/config/settings.json</code> в ветку{' '}
            <code className="font-mono text-ink-secondary">main</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={resetTab} className="btn-ghost">
            <RotateCcw size={14} /> Сбросить вкладку
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

      <div className="border-b border-line-subtle">
        <nav className="-mb-px flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                tab === t.id
                  ? 'border-lime text-lime'
                  : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {saveMutation.isError && (
        <Notice tone="error">
          Не удалось сохранить: {formatGithubApiError(saveMutation.error)}
        </Notice>
      )}

      <div className="ds-card">
        {tab === 'pipeline' && (
          <PipelineTab value={draft.pipeline} onChange={(v) => setDraft({ ...draft, pipeline: v })} />
        )}
        {tab === 'llm' && (
          <LlmTab value={draft.llm} onChange={(v) => setDraft({ ...draft, llm: v })} />
        )}
        {tab === 'brand' && (
          <BrandTab value={draft.brand} onChange={(v) => setDraft({ ...draft, brand: v })} />
        )}
        {tab === 'geo' && <GeoTab value={draft.geo} onChange={(v) => setDraft({ ...draft, geo: v })} />}
        {tab === 'season' && (
          <SeasonTab
            value={draft.seasonalPriorities}
            onChange={(v) => setDraft({ ...draft, seasonalPriorities: v })}
          />
        )}
        {tab === 'tours' && (
          <ToursTab value={draft.tourFilters} onChange={(v) => setDraft({ ...draft, tourFilters: v })} />
        )}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

function Field({ label, hint, children }: FieldProps): ReactNode {
  return (
    <label className="block">
      <span className="ds-label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}): ReactNode {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      className="ds-input-sm"
    />
  );
}

function NullableNumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  placeholder?: string;
}): ReactNode {
  return (
    <input
      type="number"
      value={value ?? ''}
      placeholder={placeholder ?? 'не задано'}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (raw === '') onChange(null);
        else {
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }
      }}
      className="ds-input-sm"
    />
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}): ReactNode {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      className="ds-input-sm"
    />
  );
}

function StringListInput({
  value,
  onChange,
  placeholder,
  hint,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  hint?: string;
}): ReactNode {
  return (
    <div className="space-y-1">
      <textarea
        value={value.join('\n')}
        placeholder={placeholder ?? 'По одной записи на строку'}
        onChange={(e) =>
          onChange(
            e.target.value
              .split('\n')
              .map((s) => s.trim())
              .filter((s) => s.length > 0),
          )
        }
        className="ds-input min-h-[110px] font-mono text-xs"
      />
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function PipelineTab({
  value,
  onChange,
}: {
  value: AgentSettingsDto['pipeline'];
  onChange: (v: AgentSettingsDto['pipeline']) => void;
}): ReactNode {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Порог уверенности (confidenceThreshold)"
        hint="Если топ-insight ниже — пайплайн помечает run как «Пропущен». 0..1"
      >
        <NumberInput
          value={value.confidenceThreshold}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => onChange({ ...value, confidenceThreshold: v })}
        />
      </Field>
      <Field label="Мин. число туров" hint="После ранжирования. Меньше — Пропущен.">
        <NumberInput
          value={value.minTours}
          min={1}
          onChange={(v) => onChange({ ...value, minTours: v })}
        />
      </Field>
      <Field label="Макс. число туров">
        <NumberInput
          value={value.maxTours}
          min={1}
          onChange={(v) => onChange({ ...value, maxTours: v })}
        />
      </Field>
      <Field label="Лимит запроса туров (YouTravel)" hint="Сколько брать из API для последующего ранжирования.">
        <NumberInput
          value={value.tourSearchLimit}
          min={1}
          max={200}
          onChange={(v) => onChange({ ...value, tourSearchLimit: v })}
        />
      </Field>
      <Field label="Новости: макс. возраст, дней">
        <NumberInput
          value={value.newsMaxAgeDays}
          min={1}
          max={365}
          onChange={(v) => onChange({ ...value, newsMaxAgeDays: v })}
        />
      </Field>
      <Field label="Новостей с одного источника">
        <NumberInput
          value={value.newsMaxPerSource}
          min={1}
          max={50}
          onChange={(v) => onChange({ ...value, newsMaxPerSource: v })}
        />
      </Field>
    </div>
  );
}

function LlmTab({
  value,
  onChange,
}: {
  value: AgentSettingsDto['llm'];
  onChange: (v: AgentSettingsDto['llm']) => void;
}): ReactNode {
  return (
    <div className="space-y-4">
      <Field
        label="Модель Anthropic (опц.)"
        hint="Если пусто — используется ANTHROPIC_MODEL из env (по умолчанию claude-sonnet-4-5)."
      >
        <TextInput
          value={value.model ?? ''}
          placeholder="claude-sonnet-4-5"
          onChange={(s) => onChange({ ...value, model: s || undefined })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Max tokens">
          <NumberInput
            value={value.maxTokens}
            min={256}
            max={8192}
            onChange={(v) => onChange({ ...value, maxTokens: v })}
          />
        </Field>
      </div>
      <div>
        <h4 className="ds-label">Temperature по шагам</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['analyzer', 'post', 'landing', 'factcheck'] as const).map((step) => (
            <Field key={step} label={step}>
              <NumberInput
                value={value.temperature[step]}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) =>
                  onChange({ ...value, temperature: { ...value.temperature, [step]: v } })
                }
              />
            </Field>
          ))}
        </div>
      </div>
    </div>
  );
}

function BrandTab({
  value,
  onChange,
}: {
  value: AgentSettingsDto['brand'];
  onChange: (v: AgentSettingsDto['brand']) => void;
}): ReactNode {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Название бренда">
          <TextInput value={value.name} onChange={(s) => onChange({ ...value, name: s })} />
        </Field>
        <Field label="Голос бренда" hint="Подставляется в каждый LLM-вызов.">
          <select
            value={value.voice}
            onChange={(e) => onChange({ ...value, voice: e.target.value as BrandVoice })}
            className="ds-input-sm"
          >
            {BRAND_VOICES.map((v) => (
              <option key={v} value={v}>
                {VOICE_LABELS[v]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Целевая аудитория по умолчанию">
          <select
            value={value.defaultAudience}
            onChange={(e) =>
              onChange({ ...value, defaultAudience: e.target.value as BrandAudience })
            }
            className="ds-input-sm"
          >
            {BRAND_AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {AUDIENCE_LABELS[a]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Эмодзи в постах">
          <label className="inline-flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={value.allowEmoji}
              onChange={(e) => onChange({ ...value, allowEmoji: e.target.checked })}
              className="h-4 w-4 accent-lime"
            />
            Разрешить умеренно
          </label>
        </Field>
      </div>
      <Field
        label="Запрещённые слова / формулировки"
        hint="LLM не должен использовать; пайплайн дополнительно подсвечивает в логах."
      >
        <StringListInput
          value={value.bannedWords}
          placeholder="дёшево&#10;эконом&#10;распродажа"
          onChange={(arr) => onChange({ ...value, bannedWords: arr })}
        />
      </Field>
      <Field label="Обязательные хэштеги" hint="LLM попросят добавить в конец поста.">
        <StringListInput
          value={value.requiredHashtags}
          placeholder="#youtravel&#10;#путешествия"
          onChange={(arr) => onChange({ ...value, requiredHashtags: arr })}
        />
      </Field>
    </div>
  );
}

function GeoTab({
  value,
  onChange,
}: {
  value: AgentSettingsDto['geo'];
  onChange: (v: AgentSettingsDto['geo']) => void;
}): ReactNode {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Приоритетные страны"
        hint="При прочих равных insight по этим странам получает +0.10 к confidenceScore."
      >
        <StringListInput
          value={value.prioritized}
          placeholder="Турция&#10;Грузия"
          onChange={(arr) => onChange({ ...value, prioritized: arr })}
        />
      </Field>
      <Field
        label="Заблокированные страны"
        hint="Insight с такой страной полностью отбраковывается. Если все insights в чёрном списке — run помечается как «Пропущен» (blocked_country)."
      >
        <StringListInput
          value={value.blocked}
          placeholder="КНДР&#10;Сирия"
          onChange={(arr) => onChange({ ...value, blocked: arr })}
        />
      </Field>
    </div>
  );
}

function SeasonTab({
  value,
  onChange,
}: {
  value: AgentSettingsDto['seasonalPriorities'];
  onChange: (v: AgentSettingsDto['seasonalPriorities']) => void;
}): ReactNode {
  return (
    <div className="space-y-4">
      <Notice tone="info">
        Сезонные приоритеты: страны, упомянутые здесь, получают <strong>+0.15</strong> к
        confidenceScore, если текущий месяц попадает в диапазон.
      </Notice>
      <div className="grid gap-4 sm:grid-cols-2">
        {MONTH_RANGE_KEYS.map((k) => (
          <Field key={k} label={`${MONTH_RANGE_LABELS[k]} (${k})`}>
            <StringListInput
              value={value[k]}
              placeholder="Таиланд&#10;ОАЭ"
              onChange={(arr) => onChange({ ...value, [k]: arr } as Record<MonthRangeKey, string[]>)}
            />
          </Field>
        ))}
      </div>
    </div>
  );
}

function ToursTab({
  value,
  onChange,
}: {
  value: AgentSettingsDto['tourFilters'];
  onChange: (v: AgentSettingsDto['tourFilters']) => void;
}): ReactNode {
  return (
    <div className="space-y-4">
      <Notice tone="info">
        Мягкий фильтр: если у тура цена/количество ночей не парсятся (например, цена в евро) — тур
        останется в подборке.
      </Notice>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Мин. цена, ₽">
          <NullableNumberInput
            value={value.minPriceRub}
            onChange={(n) => onChange({ ...value, minPriceRub: n })}
          />
        </Field>
        <Field label="Макс. цена, ₽">
          <NullableNumberInput
            value={value.maxPriceRub}
            onChange={(n) => onChange({ ...value, maxPriceRub: n })}
          />
        </Field>
        <Field label="Мин. ночей">
          <NullableNumberInput
            value={value.minNights}
            onChange={(n) => onChange({ ...value, minNights: n })}
          />
        </Field>
        <Field label="Макс. ночей">
          <NullableNumberInput
            value={value.maxNights}
            onChange={(n) => onChange({ ...value, maxNights: n })}
          />
        </Field>
      </div>
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
