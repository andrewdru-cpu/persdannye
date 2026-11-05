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
- `FORM_TICKET_SECRET` — секрет подписи метки открытия формы. Нужен только при включённом сборе (`PD_COLLECTION_ENABLED=true`): тогда не короче 32 байт и не равен `PARSER_API_TOKEN`, иначе процесс не стартует. Если сбор включён, а ключа нет, подпись отвечает 503. Запасного ключа нет: ни пустой строки, ни `PARSER_API_TOKEN`. При выключенном сборе сайт стартует без ключа, а `/api/form-ticket` отвечает 503 до любой работы с подписью. `/api/lead` отвечает 410 и не читает тело.
- `NEXT_PUBLIC_SHOW_FINES=true` — вместе с `approved: true` в `content/fines.ts` показывает таблицу штрафов и калькулятор. Пока юрист не поставил `approved: true`, даже с флагом цифр нет. Без флага блок скрыт целиком.
- `PD_COLLECTION_ENABLED=true` — серверная переменная без `NEXT_PUBLIC_`. Сбор заявок, проверки URL, Метрики и необязательных cookie включается только вместе с опубликованной политикой (`show_site_legal`) и redeploy. Иначе сбор выключен.

Токены **не** отдаются в браузер — только серверный BFF.

## Parser BFF

Браузер не отправляет персональные данные на этот origin. Когда сбор включён, заявка уходит на `https://api.scanweb.pro/public/lead`, проверка URL — на `https://api.scanweb.pro/public/check`. Пока `PD_COLLECTION_ENABLED` выключен, эти запросы не делаются. Лимит тела 16 КБ. Тело ответа в лог не пишется.

- `POST /api/lead` — **410 Gone**, тело не читается
- `/api/checks` и вложенные пути — **410 Gone**
- `GET /api/scan/[id]` и `GET /api/scan/[id]/pdf` — прокси по id, без тела заявки. Форма проверки их не вызывает
- `GET /api/health` — живость процесса, без вызова парсера

`GET /api/scan/[id]` вызывает `GET ${PARSER_API_BASE}/api/scans/:id` с `Authorization: Bearer ${PARSER_API_TOKEN}` и `X-PD-Client-IP` из `X-Real-IP` (его ставит Caddy). `X-Forwarded-For` не используется. По умолчанию база — `http://api:8080`.

ПДн не пишутся на диск сайта и не попадают в лог. Уведомлений в мессенджеры нет.

Контейнер: `docker build -t persdannye-site .`, затем `docker run --rm --read-only --tmpfs /tmp --tmpfs /app/.next/cache -p 3000:3000 -e PARSER_API_BASE -e PARSER_API_TOKEN -e FORM_TICKET_SECRET -e PD_COLLECTION_ENABLED=true persdannye-site`. Каталог `.next/cache` — tmpfs из compose, не симлинк. Секреты берите из окружения, не из файла в git. Образ для compose: `ghcr.io/andrewdru-cpu/persdannye@sha256:...`.

## Что есть на сайте

- `/` — лендинг с проверкой URL, FAQ, формой заявки
- `/check` — отдельная страница проверки
- `/privacy`, `/cookies`, `/terms` — юридические страницы
- Cookie-баннер с категориями; аналитика только после согласия
- Согласие на ПДн в форме заявки и в блоке «Контакты для менеджера» (обязательный чекбокс, по умолчанию снят)
- Заявки этот origin не принимает. Страницы и API со списком заявок нет

Оператор — плательщик НПД. Плейсхолдеры `{{operator_fio}}` и `{{operator_inn}}` в репозитории пустые: реальное ФИО и ИНН сюда не писать. ОГРН нет. Файл: `lib/company.ts`.

## CI / npm audit

CI блокирует два аудита.

1. `npm audit --omit=dev --audit-level=high` — зависимости прод-сборки, без исключений.
2. Полный `npm audit --json` разбирает `scripts/audit-allowlist.mjs`. Любой high или critical роняет job.

Единственное исключение — [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (`braces`). Оно действует только если все пути к пакету идут через `eslint-config-next`: это dev-дерево ESLint, опубликованного исправления нет. `eslint-config-next` не понижаем.

Владелец исключения: Сайт 152. Пересмотр 16.11.2026 или раньше, как только выйдет фикс. После `review_by` job падает. Запись: `.github/audit-allowlist.json`.
