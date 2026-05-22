# YouTravel.me Marketing AI Agent

MVP-сервис из двух частей:

- **Agent** (`packages/agent`) — Node.js/TypeScript CLI + pipeline: читает новости из RSS/HTML-источников, выбирает travel-инфоповод через Claude, подбирает туры через YouTravel API, генерирует маркетинговый пост + статический лендинг (HTML/CSS/JS).
- **Admin** (`packages/admin`) — React-SPA на GitHub Pages: CRUD источников, запуск pipeline по кнопке (`workflow_dispatch`), live-статус, история генераций, превью лендингов.

Серверного бэкенда нет — «серверную» работу выполняют GitHub REST API (Contents API + workflow_dispatch) и GitHub Actions runner.

## Pipeline

```
sources.json → fetch news → analyze (Claude) → pick top insight
            → search tours (YouTravel API) → rank → generate post (Claude)
            → generate landing → save out/results/{slug}.json
            → commit → push → GitHub Pages
```

## Требования

- Node.js >= 20
- yarn (1.x classic)
- Аккаунт Anthropic с API-ключом
- GitHub-репозиторий с включёнными GitHub Pages (source = «GitHub Actions»)

## Структура

```
ytme-marketing-ai-agent/
├── packages/
│   ├── agent/                  # CLI + pipeline
│   │   ├── src/
│   │   │   ├── config/sources.json
│   │   │   ├── modules/{news, ai, tours, landing, deploy}/
│   │   │   ├── types/
│   │   │   ├── utils/
│   │   │   ├── pipeline.ts
│   │   │   └── cli.ts
│   │   └── tests/
│   └── admin/                  # React SPA
│       └── src/{pages, components, api, hooks, lib}/
├── landings/{slug}/            # сгенерированные лендинги (HTML/CSS/JS)
├── out/results/                # JSON-результаты + index.json
└── .github/workflows/
    ├── generate.yml            # workflow_dispatch → запускает агент
    └── deploy-pages.yml        # push в main → деплой на GH Pages
```

## Локальная установка

```bash
yarn install
cp .env.example .env
# Скопируйте .env.example → .env и вставьте СВОЙ ключ с https://console.anthropic.com/settings/keys
# (значение из .env.example — заглушка, не работает)
```

## Локальный запуск pipeline

```bash
# Прогон по всем включённым источникам:
yarn generate

# Только один источник:
yarn workspace @ytme/agent generate --source lenta-travel

# Локальная проверка конфига:
yarn validate-sources

# Список сгенерированных результатов:
yarn list

# Тесты:
yarn test
```

Сгенерированные файлы появятся в `landings/{slug}/` и `out/results/{slug}.json`.

## Локальный запуск админки

```bash
yarn admin:dev
```

При `yarn admin:dev` **owner/repo** подставляются из `git remote origin` (если не заданы в `.env`). Запросы к GitHub API идут через dev-прокси `/api/github` (без CORS).

Опционально:

```bash
cp packages/admin/.env.example packages/admin/.env.local
# VITE_REPO_OWNER=ваш-github-login
# VITE_REPO_NAME=ytme-marketing-ai-agent
```

Открыть [http://localhost:5173](http://localhost:5173) → ввести GitHub PAT.

## Настройка GitHub-репозитория

### 1. GitHub Pages (обязательно до первого деплоя)

Без этого шага workflow `deploy-pages.yml` падает с ошибкой:

```text
Get Pages site failed (404)
```

**Порядок действий:**

1. Откройте репозиторий на GitHub → **Settings** → **Pages**.
2. В блоке **Build and deployment** → **Source** выберите **GitHub Actions** (не «Deploy from a branch»).
3. Сохраните (если кнопки нет — Pages уже включён).
4. Запустите workflow вручную: **Actions** → **Deploy to GitHub Pages** → **Run workflow**.

После успешного деплоя URL: `https://<owner>.github.io/<repo>/`.

**Если пункта Pages нет в Settings:** в организации Pages может быть отключён админом — попросите включить, или используйте личный аккаунт/форк.

**Если ошибка 404 остаётся:** убедитесь, что репозиторий **public** (для free GitHub Pages на private repo нужен paid plan), и что у workflow есть права `pages: write` + `id-token: write` (уже в `deploy-pages.yml`).

### 2. GitHub Secrets

`Settings → Secrets and variables → Actions → Secrets`:

| Имя | Значение |
| --- | -------- |
| `ANTHROPIC_API_KEY` | ваш ключ Anthropic |

### 3. GitHub Variables (опционально, есть дефолты)

`Settings → Secrets and variables → Actions → Variables`:

| Имя | По умолчанию |
| --- | ------------ |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` |
| `TOUR_CLIENT_MODE` | `real` |
| `YOUTRAVEL_API_BASE_URL` | `https://youtravel.me` |
| `YOUTRAVEL_IMAGE_BASE_URL` | `https://youtravel.me/` |

### 4. Permissions для workflow

`Settings → Actions → General → Workflow permissions = "Read and write"`.

## Использование через UI

1. Откройте `https://<owner>.github.io/<repo>/`.
2. Введите GitHub Personal Access Token (см. ниже).
3. На вкладке **Источники** добавьте/выключите новостные URL.
4. На вкладке **Запустить** выберите источник и нажмите «Запустить генерацию».
5. Дождитесь завершения workflow (~1 минута) на вкладке статуса.
6. Откройте **Историю** — там появится новый результат с превью лендинга.

### Как получить GitHub PAT (fine-grained)

1. [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
2. **Resource owner**: ваш аккаунт.
3. **Repository access**: «Only select repositories» → этот репо.
4. **Permissions → Repository permissions**:
   - `Contents`: **Read and write**
   - `Actions`: **Read and write**
   - `Metadata`: **Read-only** (выставляется автоматически)
5. Создайте, скопируйте, вставьте в форму логина админки.

**Важно:** для кнопки «Запустить генерацию» нужен именно **Actions: Read and write**. Если указать только Read, появится ошибка `Resource not accessible by personal access token`.

**Альтернатива — Classic PAT:** [создать](https://github.com/settings/tokens/new?scopes=repo,workflow) со scopes `repo` + `workflow`.

PAT хранится только в `localStorage` вашего браузера. На сервер админки (которого нет) не уходит.

## Деплой

Деплой полностью автоматический:

- **При коммите в `main`** (любым способом — через UI или вручную) пайплайн `deploy-pages.yml` собирает SPA + копирует `landings/` и `out/results/` в Pages-артефакт и публикует.
- **После успешного `generate.yml`** тоже запускается `deploy-pages.yml` (чтобы `/results/index.json` на Pages совпадал с репозиторием).
- **История в админке** читает `out/results/index.json` из **GitHub API** (ветка `main`), а не только с Pages — список актуален сразу после коммита генерации.

## Расширение

### Подключить реальный YouTravel API (по умолчанию уже включён)

Активен по умолчанию (`TOUR_CLIENT_MODE=real`) и ходит на публичный endpoint:

```
GET https://youtravel.me/api/v2/serp/tours?sort_by=rank&sort_dir=desc&currency=rub&lang=ru
```

Логика клиента: `packages/agent/src/modules/tours/youtravelClient.ts`.
Маппинг ответа в наш `Tour`: `packages/agent/src/modules/tours/youtravelMapper.ts`.
Если изменится формат — поправьте схему в `youtravelSchema.ts` (zod), маппер и фикстуру теста (`tests/fixtures/youtravel-serp-sample.json`).

Для оффлайн-разработки можно переключить:

```bash
TOUR_CLIENT_MODE=mock yarn generate
```

### Сменить LLM provider

1. Создайте класс по интерфейсу `LlmClient` (см. `packages/agent/src/modules/ai/llmClient.ts`):

   ```typescript
   import type { LlmClient, LlmCompleteInput } from './llmClient.js';
   export class MyProviderClient implements LlmClient {
     async complete(input: LlmCompleteInput): Promise<string> { /* ... */ }
   }
   ```

2. В `packages/agent/src/pipeline.ts` подменить инстанцирование `AnthropicClient` на ваш класс.

Все промпты в `packages/agent/src/modules/ai/prompts.ts` — они на русском, формат JSON-ответа описан в каждом промпте.

### Добавить фильтры YouTravel

В `TourSearchInput` (`packages/agent/src/types/tour.ts`) уже зарезервированы поля `tags`, `season`. Допишите их сборку в URL внутри `youtravelClient.ts` методе `buildUrl`.

## Acceptance Criteria

ТЗ §13:

- [x] (1, 13) sources.json + CLI + UI для добавления URL.
- [x] (2) NewsFetcher (RSS / HTML+Readability).
- [x] (3) NewsAnalyzer (Claude) выбирает travel-инфоповод.
- [x] (4) TourClient (`YouTravelApiClient` real + `MockTourClient`).
- [x] (5) TourRanker выбирает 3–8 туров.
- [x] (6) PostGenerator (Claude).
- [x] (7, 8, 9) LandingGenerator с SEO/OG + адаптивностью.
- [x] (10) `generate.yml` + `deploy-pages.yml`.
- [x] (11, 12) Pipeline сохраняет JSON + URL.

Дополнительные UI-критерии:

- [x] Admin SPA публично доступна по URL GH Pages.
- [x] CRUD источников через UI (изменения = commit в main).
- [x] Запуск генерации из UI (workflow_dispatch).
- [x] Live-статус run + история генераций.
- [x] PAT только в localStorage, ANTHROPIC_API_KEY только в GH Secrets.

## Troubleshooting

| Проблема | Решение |
| --- | --- |
| `Invalid environment variables` / `ANTHROPIC_API_KEY` в CI | Локально: `.env`. В Actions: `Settings → Secrets → Actions` → secret `ANTHROPIC_API_KEY` |
| `401 authentication_error` / Invalid credentials | В `.env` и GitHub Secret — **ваш** ключ Anthropic, не копия из `.env.example`; создайте новый в Console |
| `seasonality` Expected string, received null | Обновите код на `main` (схема принимает null от LLM). Не связано с env |
| Запуск помечен «Пропущен» в Истории | Это не ошибка: пайплайн отказался публиковать слабый пост. Откройте детали — внутри причина (`low_confidence`, `unknown_country`, `no_tours`, `no_news`, `llm_error`) и подсказки. Workflow завершается успешно (exit 0). |
| `Source with id "X" not found` | Проверьте `packages/agent/src/config/sources.json` |
| `HTTP 404` для `atorus` | Старый URL `.../new.html` снят с сайта; в `sources.json` должен быть `https://www.atorus.ru/news/rss.xml`, тип `rss` |
| Admin не показывает историю | Pages-артефакт ещё кэшируется — обновите страницу через минуту |
| Workflow «Workflow does not have write permissions» | Включите `Settings → Actions → General → Workflow permissions = Read and write` |
| `Get Pages site failed` / `configure-pages` 404 | `Settings → Pages → Source = GitHub Actions`, затем перезапустите workflow |
| `Resource not accessible` при запуске из UI | PAT: **Actions → Read and write** (fine-grained) или Classic: `repo` + `workflow` |
| CORS / `api.github.com/repos///` локально | Пустые `VITE_REPO_*` — перезапустите `yarn admin:dev` (подхват git remote) или задайте `.env.local`; API проксируется через Vite |
| YouTravel API возвращает 0 туров | Проверьте лог `YouTravel SERP request`; клиент сделает fallback на client-side фильтр |

## Лицензия

UNLICENSED (private MVP).
