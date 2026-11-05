# ПерсДанные — landing + BFF

Premium dark B2B landing for Roskomnadzor / 152-FZ website compliance scanning.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS v4
- Framer Motion, Zod, clsx / tailwind-merge
- Standalone Next.js server. The browser sends leads straight to the Russian API (`https://api.scanweb.pro`) and only after collection is enabled. This origin does not accept or store them.

## Quick start (Windows)

```bat
cd /d D:\persdannye
copy .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm start` — start production server
- `npm run lint` — ESLint

## Parser BFF contract

The browser does not send personal data to this origin. When collection is on, the lead form posts to `https://api.scanweb.pro/public/lead` and the URL check posts to `https://api.scanweb.pro/public/check`. `PD_COLLECTION_ENABLED` stays off until the policy is published, so those requests are not made. Body limit is 16 KiB. The response body is not written to logs.

- `POST /api/lead` — **410 Gone**. The handler does not read the body.
- `GET|POST /api/checks` and nested paths — **410 Gone**
- `GET /api/scan/[id]` and `GET /api/scan/[id]/pdf` — optional status proxy by id. They do not accept a lead body. The check form does not call them.
- `GET /api/health` — liveness, no parser call

`GET /api/scan/[id]` calls `GET ${PARSER_API_BASE}/api/scans/:id` with `Authorization: Bearer ${PARSER_API_TOKEN}` and `X-PD-Client-IP` taken only from `X-Real-IP` (Caddy). It does not read `X-Forwarded-For`. Default `PARSER_API_BASE` is `http://api:8080`. Parser 400, 429 and 5xx are returned with the same status and a generic body.

Personal data is not written to the site disk and is not logged. There is no messenger notification.

```bash
docker build -t persdannye-site .
docker run --rm --read-only --tmpfs /tmp --tmpfs /app/.next/cache -p 3000:3000 \
  -e PARSER_API_BASE=http://api:8080 \
  -e PARSER_API_TOKEN \
  -e PD_COLLECTION_ENABLED=true \
  persdannye-site
```

`PARSER_API_TOKEN` is taken from the shell environment. Do not pass secrets as literals in a committed file. `/api/lead` responds with 410 and does not read the body.

## Сбор персональных данных

Пока политика не опубликована, сайт не принимает заявки, не запускает проверку URL, не грузит Яндекс.Метрику и не ставит необязательные cookie.

Включение — один шаг вместе с публикацией политики, затем redeploy:

1. Опубликовать политику: `show_site_legal` в `content/flags.ts`.
2. В Production задать серверную `PD_COLLECTION_ENABLED=true` (без `NEXT_PUBLIC_`).

Любое другое значение или пустая переменная оставляет сбор выключенным. Без опубликованной политики переменная не включает сбор. Решение принимает сервер (`collectionEnabled()` в `lib/collection-gate.ts`); клиент получает только boolean.

## Company / legal

The operator is an NPD payer. `{{operator_fio}}` and `{{operator_inn}}` stay empty in the repo: do not commit a real name or INN. There is no OGRN.

Routes: `/privacy`, `/cookies`, `/terms`, cookie banner (necessary / analytics / marketing), consent checkbox on the lead form and on URL-check contacts. Leads are not accepted by any page or API route on this origin.

## CI / npm audit

CI блокирует два аудита.

1. `npm audit --omit=dev --audit-level=high` — зависимости прод-сборки, без исключений.
2. Полный `npm audit --json` разбирает `scripts/audit-allowlist.mjs`. Любой high или critical роняет job.

Единственное исключение — [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (`braces`). Оно действует только если все пути к пакету идут через `eslint-config-next`: это dev-дерево ESLint, опубликованного исправления нет. `eslint-config-next` не понижаем.

Владелец исключения: Сайт 152. Пересмотр 16.11.2026 или раньше, как только выйдет фикс. После `review_by` job падает. Запись: `.github/audit-allowlist.json`.

## Russian README

See `README_RU.md`.
