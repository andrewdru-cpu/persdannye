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

- `PARSER_API_BASE` — URL парсера; если пусто, работает демо (mock)
- `PARSER_API_EMAIL` + `PARSER_API_PASSWORD` — JWT через `/api/auth/login`
- или `PARSER_API_TOKEN` — Bearer, если пользователей в БД ещё нет

Токены **не** отдаются в браузер — только серверный BFF.

## Что есть на сайте

- `/` — лендинг с проверкой URL, FAQ, формой заявки
- `/check` — отдельная страница проверки
- `/privacy`, `/cookies`, `/terms` — юридические страницы
- `/cabinet` — MVP список лидов
- Cookie-баннер с категориями; аналитика только после согласия
- Согласие на ПДн в формах (обязательный чекбокс)

Реквизиты оператора: `lib/company.ts`.
