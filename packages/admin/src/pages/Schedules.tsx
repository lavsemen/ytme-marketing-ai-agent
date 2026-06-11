import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CronExpressionParser } from 'cron-parser';
import { Plus, Trash2, Pencil, X, Play, Clock, AlertTriangle } from 'lucide-react';
import {
  CRON_PRESETS,
  DEFAULT_TZ,
  SCHEDULES_MAX_ENABLED,
  TZ_OPTIONS,
  applyScheduleChange,
  clearAllScheduleRules,
  loadSchedules,
  newScheduleId,
  normalizeScheduleRule,
  type ScheduleRuleDto,
} from '../api/schedules';
import { loadSources } from '../api/sources';
import { createGithubClient, dispatchScheduled, formatGithubApiError } from '../api/github';
import { useAuth } from '../hooks/useAuth';

type DraftRule = Omit<ScheduleRuleDto, 'id' | 'createdAt' | 'updatedAt'>;

const EMPTY_DRAFT: DraftRule = {
  enabled: true,
  name: '',
  cron: '0 9 * * *',
  tz: DEFAULT_TZ,
  source: 'all',
  hint: '',
};

export function SchedulesPage(): ReactNode {
  const { pat } = useAuth();
  const qc = useQueryClient();
  const client = useMemo(() => (pat ? createGithubClient(pat) : null), [pat]);

  const query = useQuery({
    queryKey: ['schedules'],
    queryFn: () => loadSchedules(),
  });

  const sourcesQuery = useQuery({
    queryKey: ['sources'],
    queryFn: () => loadSources(),
  });

  const saveMutation = useMutation({
    mutationFn: (mutator: (rules: ScheduleRuleDto[]) => ScheduleRuleDto[]) =>
      applyScheduleChange((current) => ({ rules: mutator(current.rules) })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
    onError: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });

  const clearAllMutation = useMutation({
    mutationFn: () => clearAllScheduleRules(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('PAT нужен для запуска workflow (Settings → PAT).');
      await dispatchScheduled(client, { force: true });
    },
  });

  const [editing, setEditing] = useState<ScheduleRuleDto | null>(null);
  const [showForm, setShowForm] = useState(false);

  const rules = query.data?.schedules.rules ?? [];
  const sources = sourcesQuery.data?.sources ?? [];
  const enabledCount = rules.filter((r) => r.enabled).length;
  const busy = saveMutation.isPending || clearAllMutation.isPending;

  function openCreate(): void {
    if (busy) return;
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(r: ScheduleRuleDto): void {
    if (busy) return;
    setEditing(r);
    setShowForm(true);
  }

  async function handleSave(draft: DraftRule, editingId: string | null): Promise<void> {
    await saveMutation.mutateAsync((rules) => {
      const now = new Date().toISOString();
      let next: ScheduleRuleDto[];
      if (editingId) {
        next = rules.map((r) =>
          r.id === editingId
            ? normalizeScheduleRule({
                ...r,
                ...draft,
                hint: draft.hint?.trim() || undefined,
                updatedAt: now,
              })
            : r,
        );
      } else {
        const newRule: ScheduleRuleDto = normalizeScheduleRule({
          id: newScheduleId(),
          ...draft,
          hint: draft.hint?.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        });
        next = [...rules, newRule];
      }
      const wouldEnabled = next.filter((r) => r.enabled).length;
      if (wouldEnabled > SCHEDULES_MAX_ENABLED) {
        throw new Error(
          `Лимит активных правил: максимум ${SCHEDULES_MAX_ENABLED}. Сейчас стало бы ${wouldEnabled}. Отключите лишние.`,
        );
      }
      return next;
    });
    setShowForm(false);
    setEditing(null);
  }

  async function handleClearAllRules(): Promise<void> {
    if (rules.length === 0) return;
    if (
      !confirm(
        'Удалить все правила расписания? Автоматические запуски прекратятся. Историю генераций по расписанию удалите командой:\nyarn workspace @ytme/agent cleanup-scheduled',
      )
    ) {
      return;
    }
    await clearAllMutation.mutateAsync();
  }

  async function handleDelete(r: ScheduleRuleDto): Promise<void> {
    if (!confirm(`Удалить правило "${r.name}"?`)) return;
    await saveMutation.mutateAsync((rules) => rules.filter((x) => x.id !== r.id));
  }

  async function handleToggle(r: ScheduleRuleDto): Promise<void> {
    const willEnable = !r.enabled;
    if (willEnable && enabledCount >= SCHEDULES_MAX_ENABLED) {
      alert(
        `Лимит активных правил: максимум ${SCHEDULES_MAX_ENABLED}. Отключите другое перед включением этого.`,
      );
      return;
    }
    await saveMutation.mutateAsync((rules) => {
      const existing = rules.find((x) => x.id === r.id);
      if (!existing) return rules;
      // Re-check limit against FRESH rules (someone else may have toggled).
      if (!existing.enabled) {
        const enabledNow = rules.filter((x) => x.enabled).length;
        if (enabledNow >= SCHEDULES_MAX_ENABLED) {
          throw new Error(
            `Лимит активных правил: максимум ${SCHEDULES_MAX_ENABLED}. Отключите другое перед включением.`,
          );
        }
      }
      return rules.map((x) =>
        x.id === r.id
          ? { ...x, enabled: !existing.enabled, updatedAt: new Date().toISOString() }
          : x,
      );
    });
  }

  if (query.isLoading) return <div className="text-sm text-ink-muted">Загружаем расписания…</div>;
  if (query.isError) {
    return (
      <div className="ds-notice ds-notice-danger">Ошибка: {errorMessage(query.error)}</div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-ink-primary">
            <span className="text-lime">Расписания</span> запусков
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Активные правила автоматически запускаются раз в час workflow{' '}
            <code className="font-mono text-ink-secondary">scheduled.yml</code>. Лимит активных правил:{' '}
            <span className={enabledCount >= SCHEDULES_MAX_ENABLED ? 'font-bold text-warning' : 'text-ink-primary'}>
              {enabledCount} / {SCHEDULES_MAX_ENABLED}
            </span>
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rules.length > 0 && (
            <button
              type="button"
              onClick={() => void handleClearAllRules()}
              disabled={busy}
              className="btn-outline text-danger border-danger/40 hover:bg-danger/10"
              title="Очистить config/schedules. Для удаления истории запусков используйте CLI cleanup-scheduled."
            >
              <Trash2 size={14} />
              {clearAllMutation.isPending ? 'Удаляем…' : 'Удалить все правила'}
            </button>
          )}
          <button
            type="button"
            onClick={() => dispatchMutation.mutate()}
            disabled={dispatchMutation.isPending || enabledCount === 0 || !pat}
            className="btn-outline"
            title={
              !pat
                ? 'Для запуска нужен GitHub PAT (Settings → PAT).'
                : 'Запускает scheduled.yml с force=true — выполнятся все включённые правила.'
            }
          >
            <Play size={14} />
            {dispatchMutation.isPending ? 'Запускаем…' : 'Запустить сейчас'}
          </button>
          <button type="button" onClick={openCreate} className="btn-primary" disabled={busy}>
            <Plus size={16} /> Добавить правило
          </button>
        </div>
      </div>

      <div className="ds-notice ds-notice-info">
        <Clock size={16} className="mt-0.5 shrink-0" />
        <div className="text-sm">
          GitHub запускает workflow по cron с задержкой до ~15 минут — это нормально. Каждый cron-тик
          сработает <strong className="text-ink-primary">ровно один раз</strong> в текущий час.
          Минимальный практический шаг: раз в час.
        </div>
      </div>

      {clearAllMutation.isError && (
        <div className="ds-notice ds-notice-danger">
          Не удалось очистить правила: {errorMessage(clearAllMutation.error)}
        </div>
      )}

      {dispatchMutation.isError && (
        <div className="ds-notice ds-notice-danger">
          Не удалось запустить: {formatGithubApiError(dispatchMutation.error)}
        </div>
      )}
      {dispatchMutation.isSuccess && (
        <div className="ds-notice ds-notice-success">
          Workflow запущен. Откройте «Историю», чтобы увидеть результаты — они появятся через 1–3 минуты.
        </div>
      )}

      <div className="ds-table-wrap">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Статус</th>
              <th>Имя</th>
              <th>Cron</th>
              <th>TZ</th>
              <th>Источник</th>
              <th>Следующий запуск</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-ink-muted">
                  Правил пока нет. Добавьте первое — например, «Каждый день 09:00 МСК».
                </td>
              </tr>
            )}
            {rules.map((r) => (
              <tr key={r.id}>
                <td>
                  <button
                    type="button"
                    onClick={() => handleToggle(r)}
                    disabled={busy}
                    className={`${r.enabled ? 'ds-badge-success' : 'ds-badge-muted'} ${busy ? 'opacity-50' : ''}`}
                  >
                    {r.enabled ? 'Активно' : 'Выключено'}
                  </button>
                </td>
                <td>
                  <div className="font-semibold text-ink-primary">{r.name}</div>
                  {r.hint && (
                    <div className="mt-0.5 max-w-xs truncate text-xs text-ink-faint" title={r.hint}>
                      Hint: {r.hint}
                    </div>
                  )}
                </td>
                <td>
                  <code className="font-mono text-xs text-ink-secondary">{r.cron}</code>
                </td>
                <td>
                  <span className="font-mono text-xs text-ink-secondary">{r.tz}</span>
                </td>
                <td>
                  <span className="text-xs text-ink-secondary">
                    {r.source === 'all'
                      ? 'Все включённые'
                      : sources.find((s) => s.id === r.source)?.name ?? r.source}
                  </span>
                </td>
                <td>
                  <NextRunHint cron={r.cron} tz={r.tz} />
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    disabled={busy}
                    className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink-primary disabled:opacity-40 disabled:hover:bg-transparent"
                    title="Изменить"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r)}
                    disabled={busy}
                    className="ml-1 rounded-md p-1.5 text-danger transition-colors hover:bg-danger/10 disabled:opacity-40 disabled:hover:bg-transparent"
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

      {saveMutation.isError && (
        <div className="ds-notice ds-notice-danger">
          Не удалось сохранить: {errorMessage(saveMutation.error)}
        </div>
      )}

      {showForm && (
        <ScheduleFormDialog
          initial={editing}
          sources={sources}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
          submitting={saveMutation.isPending}
        />
      )}
    </div>
  );
}

function NextRunHint({ cron, tz }: { cron: string; tz: string }): ReactNode {
  try {
    const interval = CronExpressionParser.parse(cron, { tz, currentDate: new Date() });
    const next = interval.next().toDate();
    const inTz = new Intl.DateTimeFormat('ru-RU', {
      timeZone: tz,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(next);
    return <span className="font-mono text-xs text-ink-secondary">{inTz}</span>;
  } catch {
    return <span className="text-xs text-danger">cron невалиден</span>;
  }
}

interface DialogProps {
  initial: ScheduleRuleDto | null;
  sources: Array<{ id: string; name: string; enabled: boolean }>;
  onClose: () => void;
  onSave: (draft: DraftRule, editingId: string | null) => Promise<void>;
  submitting: boolean;
}

function ScheduleFormDialog({ initial, sources, onClose, onSave, submitting }: DialogProps): ReactNode {
  const [draft, setDraft] = useState<DraftRule>(() =>
    initial
      ? {
          enabled: initial.enabled,
          name: initial.name,
          cron: initial.cron,
          tz: initial.tz,
          source: initial.source,
          hint: initial.hint ?? '',
        }
      : EMPTY_DRAFT,
  );
  const [error, setError] = useState<string | null>(null);

  const cronError = useMemo(() => validateCronExpr(draft.cron, draft.tz), [draft.cron, draft.tz]);
  const previewUtc = useMemo(
    () => previewRuns(draft.cron, 'UTC', 3),
    [draft.cron],
  );
  const previewTz = useMemo(
    () => previewRuns(draft.cron, draft.tz, 3),
    [draft.cron, draft.tz],
  );

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!draft.name.trim()) {
      setError('Укажите имя правила.');
      return;
    }
    if (cronError) {
      setError(`Cron невалиден: ${cronError}`);
      return;
    }
    try {
      await onSave({ ...draft, name: draft.name.trim() }, initial?.id ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl ds-card-dark border border-line max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold uppercase tracking-tight text-ink-primary">
            {initial ? 'Изменить правило' : 'Новое правило'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink-primary"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="ds-label">Имя правила</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Утренний слот"
              className="ds-input"
              maxLength={80}
              required
            />
          </div>

          <div>
            <label className="ds-label">Cron-выражение</label>
            <input
              type="text"
              value={draft.cron}
              onChange={(e) => setDraft({ ...draft, cron: e.target.value })}
              placeholder="0 9 * * *"
              className="ds-input font-mono"
              required
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CRON_PRESETS.map((p) => (
                <button
                  key={p.cron}
                  type="button"
                  onClick={() => setDraft({ ...draft, cron: p.cron })}
                  className="ds-tag"
                  title={p.description}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {cronError && (
              <p className="mt-1.5 text-xs text-danger">Cron невалиден: {cronError}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="ds-label">Часовой пояс</label>
              <select
                value={draft.tz}
                onChange={(e) => setDraft({ ...draft, tz: e.target.value })}
                className="ds-input"
              >
                {TZ_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ds-label">Источник</label>
              <select
                value={draft.source}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                className="ds-input"
              >
                <option value="all">Все включённые источники</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id} disabled={!s.enabled}>
                    {s.name} {s.enabled ? '' : '(выключен)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="ds-label">Уточнение для LLM (опционально)</label>
            <textarea
              value={draft.hint ?? ''}
              onChange={(e) => setDraft({ ...draft, hint: e.target.value })}
              placeholder="Премиум-сегмент, гастрономия и винные туры"
              className="ds-input min-h-[80px]"
              maxLength={800}
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              className="h-4 w-4 accent-lime"
            />
            Активно
          </label>

          {!cronError && (
            <div className="rounded-lg bg-surface-1 border border-line-subtle p-3 text-xs">
              <p className="ds-label mb-2">Следующие 3 запуска</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xxs uppercase tracking-wider text-ink-faint">
                    В выбранной TZ ({draft.tz})
                  </p>
                  <ul className="mt-1 space-y-0.5 font-mono text-ink-primary">
                    {previewTz.map((d, i) => (
                      <li key={i}>{formatInTz(d, draft.tz)}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xxs uppercase tracking-wider text-ink-faint">UTC</p>
                  <ul className="mt-1 space-y-0.5 font-mono text-ink-secondary">
                    {previewUtc.map((d, i) => (
                      <li key={i}>{formatInTz(d, 'UTC')}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="ds-notice ds-notice-danger">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div className="text-sm">{error}</div>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Отмена
            </button>
            <button type="submit" disabled={submitting || !!cronError} className="btn-primary">
              {submitting ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function validateCronExpr(cron: string, tz: string): string | null {
  try {
    CronExpressionParser.parse(cron, { tz });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

function previewRuns(cron: string, tz: string, n: number): Date[] {
  try {
    const interval = CronExpressionParser.parse(cron, { tz, currentDate: new Date() });
    const out: Date[] = [];
    for (let i = 0; i < n; i += 1) out.push(interval.next().toDate());
    return out;
  } catch {
    return [];
  }
}

function formatInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
