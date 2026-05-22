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
# Заполните ANTHROPIC_API_KEY (минимум) и LANDING_BASE_URL
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
cp packages/admin/.env.example packages/admin/.env.local
# Установите VITE_REPO_OWNER и VITE_REPO_NAME
yarn admin:dev
```

Открыть [http://localhost:5173](http://localhost:5173) → ввести GitHub PAT.

## Настройка GitHub-репозитория

### 1. GitHub Pages

`Settings → Pages → Source = GitHub Actions`.

После первого деплоя URL будет `https://<owner>.github.io/<repo>/`.

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

PAT хранится только в `localStorage` вашего браузера. На сервер админки (которого нет) не уходит.

## Деплой

Деплой полностью автоматический:

- **При коммите в `main`** (любым способом — через UI или вручную) пайплайн `deploy-pages.yml` собирает SPA + копирует `landings/` и `out/results/` в Pages-артефакт и публикует.
- **При запуске генерации** из UI вызывается `generate.yml`, который выполняет pipeline в runner'е и коммитит результат в `main`. Это автоматически триггерит `deploy-pages.yml`.

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
| `Invalid environment variables` | Заполните `.env` по образцу `.env.example` |
| `Source with id "X" not found` | Проверьте `packages/agent/src/config/sources.json` |
| `Pipeline: no news fetched` | Источник не отвечает или RSS пустой — посмотрите `LOG_LEVEL=debug` |
| `confidenceScore < 0.4` | LLM считает, что ни одна новость не подходит — добавьте более релевантный источник |
| Admin не показывает историю | Pages-артефакт ещё кэшируется — обновите страницу через минуту |
| Workflow «Workflow does not have write permissions» | Включите `Settings → Actions → General → Workflow permissions = Read and write` |
| YouTravel API возвращает 0 туров | Проверьте лог `YouTravel SERP request`; клиент сделает fallback на client-side фильтр |

## Лицензия

UNLICENSED (private MVP).
