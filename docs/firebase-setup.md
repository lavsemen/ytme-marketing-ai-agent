# Firebase / Firestore: первоначальная настройка

Firestore — основное хранилище News2Trip: конфиги (`sources`, `prompts`, `settings`, `schedules`), история запусков, результаты пайплайна, метрики лендингов и allowlist админов живут здесь. Без настроенного Firebase агент и админка не запустятся.

## 1. Создать проект Firebase

1. Открыть [console.firebase.google.com](https://console.firebase.google.com/), нажать «Add project».
2. Google Analytics — по желанию, для текущего MVP не нужно.
3. После создания: Build → Firestore Database → Create database → Native mode → регион `europe-west3` (или ближайший к команде).

## 2. Включить GitHub OAuth для Firebase Auth

1. В Firebase: Build → Authentication → Get started → Sign-in method → GitHub → Enable.
2. Скопировать redirect URL вида `https://<projectId>.firebaseapp.com/__/auth/handler`.
3. Создать GitHub OAuth App: [github.com/settings/developers](https://github.com/settings/developers) → New OAuth App.
   - Homepage: `https://<github-user>.github.io/<repo>/`
   - Authorization callback URL: redirect URL из п. 2.
4. Скопировать Client ID и Client Secret обратно в Firebase Auth → GitHub provider.
5. Authentication → Settings → Authorized domains: добавить `<github-user>.github.io`.

## 3. Развернуть Security Rules и индексы

Установить Firebase CLI один раз:

```bash
npm install -g firebase-tools
firebase login
firebase use --add <projectId>
```

Деплой:

```bash
firebase deploy --only firestore
```

Файлы лежат в [infra/firebase/](../infra/firebase/) и описаны в [firebase.json](../firebase.json).

## 4. Service account для GitHub Actions

1. Firebase Console → Project Settings → Service accounts → Generate new private key.
2. Скачанный JSON **минифицировать в одну строку** и положить в GitHub Secret `FIREBASE_SERVICE_ACCOUNT_JSON`:

```bash
# macOS / Linux — из файла key.json:
jq -c . key.json | pbcopy   # или просто вывести и скопировать
# либо:
node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('key.json','utf8'))))"
```

> **Важно:** в Secret кладите **только JSON** — без `FIREBASE_SERVICE_ACCOUNT_JSON=`, без внешних кавычек `'…'`, без markdown-блоков.  
> Многострочный pretty-printed JSON часто ломается при передаче через env — используйте одну строку.  
> В CI workflow JSON записывается во временный файл (`GOOGLE_APPLICATION_CREDENTIALS`); шаг **Setup Firebase credentials** проверит валидность до запуска пайплайна.

3. Дополнительно положить project id в GitHub Variable `FIREBASE_PROJECT_ID` (или в тот же JSON — он там уже есть).

## 5. Web SDK config в админке

1. Firebase Console → Project Settings → General → «Your apps» → Add app → Web.
2. Скопировать конфиг и положить в **корневой** `.env` или `.env.local` (или в GitHub Variables для production-сборки):

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=<projectId>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<projectId>
VITE_FIREBASE_APP_ID=...
```

`apiKey` Firebase публичный — это нормально, защита обеспечивается Authorized domains и Security Rules.

## 6. Allowlist админов

Юзер заводится в Firestore автоматически (документ `users/<githubLogin>` при первом входе через SPA) с флагом `admin: false`. Чтобы выдать доступ — открыть документ в Firebase Console и переключить `admin: true`.

## 7. Одноразовая миграция данных (опционально)

Если есть исторические JSON-файлы (`packages/agent/src/config/*.json`, `out/results/*.json`) и нужно перенести их в Firestore:

```bash
export FIREBASE_PROJECT_ID=<projectId>
export FIREBASE_SERVICE_ACCOUNT_JSON='<минифицированный JSON>'
yarn workspace @ytme/agent migrate-firestore
```

Скрипт идемпотентный — повторный запуск не дублирует данные.

## 8. Production-окружение

В GitHub Settings → Secrets / Variables проекта должны быть заданы:

| Имя | Тип | Что | 
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Secret | Минифицированный service-account JSON |
| `FIREBASE_PROJECT_ID` | Variable | ID проекта Firebase |
| `FIREBASE_WEB_API_KEY` | Variable | Web SDK apiKey (публичный, начинается с `AIza`) |
| `FIREBASE_WEB_AUTH_DOMAIN` | Variable | `<projectId>.firebaseapp.com` |
| `FIREBASE_WEB_APP_ID` | Variable | Web SDK appId |

> **Имена важны:** workflow читает `FIREBASE_WEB_*` (или альias `VITE_FIREBASE_*`).  
> Не путайте с `FIREBASE_SERVICE_ACCOUNT_JSON` (Secret) — это другой ключ для agent/CI, не для SPA.

После этого `generate.yml` / `scheduled.yml` пишут в Firestore, а `deploy-pages.yml` собирает SPA с уже подставленными `VITE_FIREBASE_*` переменными.

### Troubleshooting: `auth/invalid-api-key` на GitHub Pages

1. **Variables, не Secrets** — для SPA нужны именно **Actions → Variables** (`FIREBASE_WEB_API_KEY` и т.д.).
2. **Значение `apiKey`** — Firebase Console → Project Settings → General → Your apps → Web → `apiKey` (строка `AIza…`). Не project id и не service account JSON.
3. **Пересборка** — после смены Variables: Actions → **Deploy to GitHub Pages** → Run workflow. Имя JS-бандла (`index-….js`) должно измениться.
4. **Authorized domains** — Firebase → Authentication → Settings → Authorized domains → добавьте `<user>.github.io`.
5. Если CI падает на **Verify Firebase config in bundle** — переменные не дошли до Vite; проверьте имена Variables.
