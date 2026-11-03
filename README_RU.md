# ПерсДанные

Премиальный тёмный B2B-лендинг сканера соответствия сайтов 152-ФЗ / РКН.

## Запуск на Windows

```bat
cd /d D:\persdannye
copy .env.example .env.local
npm install
npm run dev
```

Откройте http://localhost:3000

Сборка: `npm run build`

## Переменные окружения

См. `.env.example`:

- `PARSER_API_BASE` — URL парсера. Если пусто, сервер использует `http://api:8080`.
- `PARSER_API_TOKEN` — Bearer для `POST /api/scans`. В репозиторий не кладётся.
- `NEXT_PUBLIC_SHOW_FINES=true` — вместе с `approved: true` в `content/fines.ts` показывает таблицу штрафов и калькулятор. Пока юрист не поставил `approved: true`, даже с флагом цифр нет. Без флага блок скрыт целиком.
- `PD_COLLECTION_ENABLED=true` — серверная переменная без `NEXT_PUBLIC_`. Сбор заявок, проверки URL, Метрики и необязательных cookie включается только вместе с опубликованной политикой (`show_site_legal`) и redeploy. Иначе сбор выключен.

Токены **не** отдаются в браузер — только серверный BFF.

## Parser BFF

Браузер вызывает только:

- `POST /api/lead` — заявка и проверка URL. Успех — **200** и id скана. Нет заголовка `X-Real-IP` — **400**. Лимит тела 16 КБ.
- `GET /api/scan/[id]` — статус (poll 1,5 с, пока проверка идёт)
- `GET /api/scan/[id]/pdf` — прокси PDF
- `GET /api/health` — живость процесса, без вызова парсера

Сервер вызывает `POST ${PARSER_API_BASE}/api/scans` с `Authorization: Bearer ${PARSER_API_TOKEN}` и `X-PD-Client-IP` из `X-Real-IP` (его ставит Caddy). `X-Forwarded-For` не используется. По умолчанию база — `http://api:8080`.

ПДн не пишутся на диск сайта и не уходят в Telegram или другие внешние сервисы. В логах нет полей формы, IP и токена.

Контейнер: `docker build -t persdannye-site .`, затем `docker run --rm --read-only --tmpfs /tmp -p 3000:3000 -e PARSER_API_BASE -e PARSER_API_TOKEN -e PD_COLLECTION_ENABLED=true persdannye-site`. Токен берите из окружения, не из файла в git.

## Что есть на сайте

- `/` — лендинг с проверкой URL, FAQ, формой заявки
- `/check` — отдельная страница проверки
- `/privacy`, `/cookies`, `/terms` — юридические страницы
- Cookie-баннер с категориями; аналитика только после согласия
- Согласие на ПДн в форме заявки и в блоке «Контакты для менеджера» (обязательный чекбокс, по умолчанию снят)
- Заявки принимаются только `POST /api/lead`. Страницы и API со списком заявок нет

Реквизиты оператора: `lib/company.ts`.

## CI / npm audit

CI блокирует два аудита.

1. `npm audit --omit=dev --audit-level=high` — зависимости прод-сборки, без исключений.
2. Полный `npm audit --json` разбирает `scripts/audit-allowlist.mjs`. Любой high или critical роняет job.

Единственное исключение — [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (`braces`). Оно действует только если все пути к пакету идут через `eslint-config-next`: это dev-дерево ESLint, опубликованного исправления нет. `eslint-config-next` не понижаем.

Владелец исключения: Сайт 152. Пересмотр 16.11.2026 или раньше, как только выйдет фикс. После `review_by` job падает. Запись: `.github/audit-allowlist.json`.
