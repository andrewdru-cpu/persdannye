# ПерсДанные — landing + BFF

Premium dark B2B landing for Roskomnadzor / 152-FZ website compliance scanning.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS v4
- Framer Motion, Zod, clsx / tailwind-merge
- Mock parser when `PARSER_API_BASE` is unset; real VPS parser via env

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

- `POST /api/checks` `{ "url": "https://…", "lead?": { "name", "email", "phone", "consent", "consent_text_version" } }` → check job. Any contact without `consent: true` is rejected with 400
- `GET /api/checks/[id]` → status / findings (poll every 1.5s while active); on every `phase=done`, BFF notifies Telegram
- `GET /api/checks/[id]/pdf` → server-side PDF proxy (parser Bearer never reaches the browser)
- `POST /api/leads` → lead with required consent + Telegram notify

When `PARSER_API_BASE` is set, the BFF:

1. Authenticates with `PARSER_API_EMAIL` + `PARSER_API_PASSWORD` via `POST {BASE}/api/auth/login` (JWT cached server-side), **or** uses `PARSER_API_TOKEN` as Bearer
2. Creates scan: `POST {BASE}/api/scans` always `{ "url", "mode": "quick" }`, plus `lead: { name, email, phone, consent: true, consent_text_version, source: "landing" }` when the visitor left contacts and consented. If an older parser rejects those fields, the BFF retries without `lead`, then with `{ "url" }` only.
3. Polls: `GET {BASE}/api/scans/{scan_id}` until `phase` ∈ `done|error|blocked`
4. PDF: `GET {BASE}/api/scans/{scan_id}/pdf` (only from the BFF)

All parser fetches send `ngrok-skip-browser-warning: true` so free ngrok tunnels work from Vercel/Node (no browser interstitial).

Phases: `queued|open|extract|rules|pdf` (+ terminal). Landing risks = `push===true` OR `findings.length>0` when `phase===done`.

Without a public `PARSER_API_BASE` the site uses a polished mock parser.

Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`): every finished landing scan («Новый клиент с лендинга»: domain, score, risks yes/no, findings, contacts, link) plus new-lead alerts. PDF `sendDocument` only when `pdf_ready` and the scan has risks. Missing Telegram env is a logged skip, not a crash.

Public without auth on parser: `GET {BASE}/api/health` only.

## Сбор персональных данных

Пока политика не опубликована, сайт не принимает заявки, не запускает проверку URL, не грузит Яндекс.Метрику и не ставит необязательные cookie.

Включение — один шаг вместе с публикацией политики, затем redeploy:

1. Опубликовать политику: `show_site_legal` в `content/flags.ts`.
2. В Production задать серверную `PD_COLLECTION_ENABLED=true` (без `NEXT_PUBLIC_`).

Любое другое значение или пустая переменная оставляет сбор выключенным. Без опубликованной политики переменная не включает сбор. Решение принимает сервер (`collectionEnabled()` в `lib/collection-gate.ts`); клиент получает только boolean.

## Company / legal

Edit `lib/company.ts` (INN, OGRN, address, emails, phone).

Routes: `/privacy`, `/cookies`, `/terms`, cookie banner (necessary / analytics / marketing), consent checkbox on the lead form and on URL-check contacts. Leads are accepted only via `POST /api/leads` and are not listed by any page or API route.

## CI / npm audit

CI блокирует два аудита.

1. `npm audit --omit=dev --audit-level=high` — зависимости прод-сборки, без исключений.
2. Полный `npm audit --json` разбирает `scripts/audit-allowlist.mjs`. Любой high или critical роняет job.

Единственное исключение — [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (`braces`). Оно действует только если все пути к пакету идут через `eslint-config-next`: это dev-дерево ESLint, опубликованного исправления нет. `eslint-config-next` не понижаем.

Владелец исключения: Сайт 152. Пересмотр 16.11.2026 или раньше, как только выйдет фикс. После `review_by` job падает. Запись: `.github/audit-allowlist.json`.

## Russian README

See `README_RU.md`.
