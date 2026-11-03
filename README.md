# ПерсДанные — landing + BFF

Premium dark B2B landing for Roskomnadzor / 152-FZ website compliance scanning.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS v4
- Framer Motion, Zod, clsx / tailwind-merge
- Standalone Next.js server. Leads go to the parser in the same compose; the site does not store them or send them to Telegram.

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

Client never sees tokens. Browser calls only:

- `POST /api/lead` — form (url, contacts). The server sets `consent_version` from a code constant and `consent_at` to the current ISO time. `checkId` is sent as `lead.scan_id`. Success is **200** with a scan id. Missing `X-Real-IP` is **400**. A signed open-time shorter than 3 seconds returns `{ "ok": true }` and does not call the parser. Body limit is 16 KiB.
- `GET|POST /api/checks` and nested paths — **410 Gone**
- `GET /api/scan/[id]` — scan status (poll every 1.5s while active)
- `GET /api/scan/[id]/pdf` — server-side PDF proxy
- `GET /api/health` — liveness, no parser call

The BFF calls `POST ${PARSER_API_BASE}/api/scans` with `Authorization: Bearer ${PARSER_API_TOKEN}` and `X-PD-Client-IP` taken only from `X-Real-IP` (Caddy). It does not read `X-Forwarded-For`. Default `PARSER_API_BASE` is `http://api:8080`. Parser 400, 429 and 5xx are returned with the same status and a generic body.

Personal data is not written to the site disk and is not sent to Telegram or any other external service. Logs do not contain form fields, the client IP, or the token.

```bash
docker build -t persdannye-site .
docker run --rm --read-only --tmpfs /tmp --tmpfs /app/.next/cache -p 3000:3000 \
  -e PARSER_API_BASE=http://api:8080 \
  -e PARSER_API_TOKEN \
  -e PD_COLLECTION_ENABLED=true \
  persdannye-site
```

`PARSER_API_TOKEN` is taken from the shell environment. Do not pass the secret as a literal in the command line of a committed file.

## Сбор персональных данных

Пока политика не опубликована, сайт не принимает заявки, не запускает проверку URL, не грузит Яндекс.Метрику и не ставит необязательные cookie.

Включение — один шаг вместе с публикацией политики, затем redeploy:

1. Опубликовать политику: `show_site_legal` в `content/flags.ts`.
2. В Production задать серверную `PD_COLLECTION_ENABLED=true` (без `NEXT_PUBLIC_`).

Любое другое значение или пустая переменная оставляет сбор выключенным. Без опубликованной политики переменная не включает сбор. Решение принимает сервер (`collectionEnabled()` в `lib/collection-gate.ts`); клиент получает только boolean.

## Company / legal

Edit `lib/company.ts` (INN, OGRN, address, emails, phone).

Routes: `/privacy`, `/cookies`, `/terms`, cookie banner (necessary / analytics / marketing), consent checkbox on the lead form and on URL-check contacts. Leads are accepted only via `POST /api/lead` and are not listed by any page or API route.

## CI / npm audit

CI блокирует два аудита.

1. `npm audit --omit=dev --audit-level=high` — зависимости прод-сборки, без исключений.
2. Полный `npm audit --json` разбирает `scripts/audit-allowlist.mjs`. Любой high или critical роняет job.

Единственное исключение — [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (`braces`). Оно действует только если все пути к пакету идут через `eslint-config-next`: это dev-дерево ESLint, опубликованного исправления нет. `eslint-config-next` не понижаем.

Владелец исключения: Сайт 152. Пересмотр 16.11.2026 или раньше, как только выйдет фикс. После `review_by` job падает. Запись: `.github/audit-allowlist.json`.

## Russian README

See `README_RU.md`.
