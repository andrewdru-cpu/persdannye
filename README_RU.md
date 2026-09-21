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

- `PARSER_API_BASE` — публичный URL парсера. **Если не задан, сайт работает на отполированном mock.**
- `PARSER_API_EMAIL` + `PARSER_API_PASSWORD` — JWT через `POST {BASE}/api/auth/login`
- или `PARSER_API_TOKEN` — Bearer, если пользователей в БД ещё нет
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` — мгновенные алерты менеджеру
- `TELEGRAM_NOTIFY_ON_CLEAN=false` — по умолчанию не писать, если рисков нет

Токены **не** отдаются в браузер — только серверный BFF.

## Как работают алерты

Когда заданы `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`, BFF пишет менеджеру в Telegram:

1. **Проверка URL завершилась с рисками** (`push === true` **или** `findings.length > 0` при `phase === done`):
   - сразу после опроса статуса (`GET /api/checks/{id}`)
   - текст: домен, балл, фаза, список находок (`rule_id` / title / fact), время, `source=landing`
   - если по этой проверке уже есть заявка (имя / телефон / email / компания) — контакты добавляются в сообщение
   - если `pdf_ready`, сервер скачивает PDF с парсера `GET /api/scans/{id}/pdf` (Bearer только на сервере) и отправляет `sendDocument` буфером
2. **Новая заявка** (`POST /api/leads`) — отдельное сообщение с полями формы

Без Telegram-переменных сайт работает как обычно, алерты просто не уходят.

## Parser BFF

Браузер вызывает только:

- `POST /api/checks` `{ "url" }` — создать проверку
- `GET /api/checks/[id]` — статус / находки (poll 2–3 с)
- `GET /api/checks/[id]/pdf` — прокси PDF с авторизацией на сервере
- `POST /api/leads` — заявка с обязательным согласием

Если `PARSER_API_BASE` задан, BFF логинится в парсер, создаёт скан и маппит фазы `queued | open | extract | rules | pdf` (+ `done | error | blocked`).

## Что есть на сайте

- `/` — лендинг с проверкой URL, FAQ, формой заявки
- `/check` — отдельная страница проверки
- `/privacy`, `/cookies`, `/terms` — юридические страницы
- `/cabinet` — MVP список лидов
- Cookie-баннер с категориями; аналитика только после согласия
- Согласие на ПДн в формах (обязательный чекбокс)

Реквизиты оператора: `lib/company.ts`.
