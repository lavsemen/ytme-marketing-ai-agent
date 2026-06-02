# YouTravel.me Marketing AI Agent

MVP-сервис из двух частей:

- **Agent** (`packages/agent`) — Node.js/TypeScript CLI + pipeline: читает новости из RSS/HTML-источников, выбирает travel-инфоповод через Claude, подбирает туры через YouTravel API, генерирует маркетинговый пост + статический лендинг (HTML/CSS/JS).
- **Admin** (`packages/admin`) — React-SPA на GitHub Pages: CRUD источников, запуск pipeline по кнопке (`workflow_dispatch`), live-статус, история генераций, превью лендингов.

Серверного бэкенда нет — «серверную» работу выполняют GitHub REST API (Contents API + workflow_dispatch) и GitHub Actions runner.

## Pipeline

```
Firestore config/sources → fetch news → analyze (Claude) → pick top insight
            → search tours (YouTravel API) → rank → generate post (Claude)
            → generate landing → write results/{slug} & metrics/{slug} (Firestore)
            → commit landing HTML → push → GitHub Pages
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
│   │   │   ├── config/         # defaults (читаются для миграции и как fallback)
│   │   │   ├── db/firestore.ts # firebase-admin singleton
│   │   │   ├── modules/{news, ai, tours, landing, deploy}/
│   │   │   ├── tools/migrate-to-firestore.ts
│   │   │   ├── pipeline.ts
│   │   │   └── cli.ts
│   │   └── tests/
│   └── admin/                  # React SPA
│       └── src/{pages, components, api, hooks, lib}/
├── infra/firebase/             # firestore.rules + firestore.indexes.json
├── landings/{slug}/            # сгенерированные лендинги (HTML/CSS/JS)
└── .github/workflows/
    ├── generate.yml            # workflow_dispatch → запускает агент
    ├── scheduled.yml           # cron каждый час → агент по расписанию
    └── deploy-pages.yml        # push в main / после генерации → деплой SPA + landings
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

Сгенерированный лендинг появится в `landings/{slug}/`. Метаданные результата сохраняются в Firestore `results/{slug}`.

## Локальный запуск админки

```bash
yarn admin:dev
```

При `yarn admin:dev` **owner/repo** подставляются из `git remote origin` (если не заданы в `.env`). Запросы к GitHub API идут через dev-прокси `/api/github` (без CORS).

Переменные админки (`VITE_*`, включая Firebase) читаются из **корневого** `.env` / `.env.local`. После изменения env перезапустите dev-сервер.

```bash
cp .env.example .env
# Заполните VITE_FIREBASE_* (см. docs/firebase-setup.md)
```

Опционально: переопределения можно положить в `packages/admin/.env.local` — они имеют приоритет над корневым файлом.

Открыть [http://localhost:5173](http://localhost:5173) → войти через GitHub OAuth (Firebase должен быть настроен, см. [docs/firebase-setup.md](docs/firebase-setup.md)). PAT задаётся отдельно при необходимости запускать workflow.

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

### 5. Firestore — основное хранилище

Конфиги (`sources`, `prompts`, `settings`, `schedules`), история запусков, результаты пайплайна и метрики лендингов живут в Firebase Firestore. Git хранит только код и статические лендинги. Без настроенного Firebase агент и админка не запустятся.

Полный гайд: [docs/firebase-setup.md](docs/firebase-setup.md). Минимум:

1. Создать Firebase-проект → включить Firestore (native) и Authentication → GitHub provider.
2. Скачать service-account JSON и положить в GitHub Secret `FIREBASE_SERVICE_ACCOUNT_JSON`.
3. В `Settings → Variables` задать `FIREBASE_PROJECT_ID`, web-конфиг (`FIREBASE_WEB_API_KEY`, `FIREBASE_WEB_AUTH_DOMAIN`, `FIREBASE_WEB_APP_ID`).
4. Деплой rules и индексов: `firebase deploy --only firestore` (файлы в `infra/firebase/`).
5. (Опционально) Одноразовая миграция исторических JSON-данных:
   ```bash
   FIREBASE_PROJECT_ID=... \
   FIREBASE_SERVICE_ACCOUNT_JSON='<json>' \
   yarn workspace @ytme/agent migrate-firestore
   ```

## Использование через UI

1. Откройте `https://<owner>.github.io/<repo>/`.
2. Залогиньтесь через GitHub OAuth. Первый раз — попросите администратора в Firebase Console → Firestore → `users/<login>` поставить `admin: true`.
3. На вкладке **Источники** добавьте/выключите новостные URL.
4. На вкладке **Запустить** выберите источник и нажмите «Запустить генерацию» (для запуска workflow один раз сохраните GitHub PAT во вкладке Login → «Дополнительно»).
5. Дождитесь завершения workflow (~1 минута) на вкладке статуса.
6. Откройте **Историю** — там появится новый результат с превью лендинга (обновляется в реальном времени через Firestore).

### Как получить GitHub PAT (опционально — только для запуска workflow)

Аутентификация в админке идёт через Firebase GitHub OAuth, но **запуск** workflow с кнопки «Запустить генерацию» / «Запустить сейчас» требует PAT с правом `Actions: write`, так как OAuth-scope сюда не входит.

1. [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
2. **Resource owner**: ваш аккаунт.
3. **Repository access**: «Only select repositories» → этот репо.
4. **Permissions → Repository permissions**:
   - `Actions`: **Read and write**
   - `Metadata`: **Read-only** (выставляется автоматически)
5. Создайте, скопируйте, вставьте в админке: Login → «Дополнительно: задать PAT».

**Альтернатива — Classic PAT:** [создать](https://github.com/settings/tokens/new?scopes=repo,workflow) со scopes `repo` + `workflow`.

PAT хранится только в `localStorage` вашего браузера.

## Деплой

Деплой полностью автоматический:

- **При коммите в `main`** (любым способом — через UI или вручную) пайплайн `deploy-pages.yml` собирает SPA + копирует `landings/` в Pages-артефакт и публикует.
- **После успешного `generate.yml` / `scheduled.yml`** тоже запускается `deploy-pages.yml`, чтобы новые HTML-лендинги уехали в Pages.
- **История в админке** подписывается на Firestore `results` через `onSnapshot` — список обновляется в реальном времени без перезагрузки.

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
| `Source with id "X" not found` | Откройте админку → «Источники» и убедитесь, что нужный id есть в Firestore (`config/sources`) |
| `HTTP 404` для `atorus` | Старый URL `.../new.html` снят с сайта; в источниках должен быть `https://www.atorus.ru/news/rss.xml`, тип `rss` |
| Admin не показывает историю | Проверьте: 1) Firestore настроен, 2) у пользователя `users/<login>.admin = true`, 3) индексы задеплоены (`firebase deploy --only firestore`) |
| Workflow «Workflow does not have write permissions» | Включите `Settings → Actions → General → Workflow permissions = Read and write` |
| `Get Pages site failed` / `configure-pages` 404 | `Settings → Pages → Source = GitHub Actions`, затем перезапустите workflow |
| `Resource not accessible` при запуске из UI | PAT: **Actions → Read and write** (fine-grained) или Classic: `repo` + `workflow` |
| CORS / `api.github.com/repos///` локально | Пустые `VITE_REPO_*` — перезапустите `yarn admin:dev` (подхват git remote) или задайте в корневом `.env.local`; API проксируется через Vite |
| YouTravel API возвращает 0 туров | Проверьте лог `YouTravel SERP request`; клиент сделает fallback на client-side фильтр |

## Лицензия

UNLICENSED (private MVP).
