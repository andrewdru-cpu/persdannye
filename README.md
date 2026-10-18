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
- `POST /api/leads` → lead with required consent + Telegram notify. `Origin` must exactly match one entry in `ALLOWED_ORIGINS`

When `PARSER_API_BASE` is set, the BFF:

1. Authenticates with `PARSER_API_EMAIL` + `PARSER_API_PASSWORD` via `POST {BASE}/api/auth/login` (JWT cached server-side), **or** uses `PARSER_API_TOKEN` as Bearer
2. Creates scan: `POST {BASE}/api/scans` always `{ "url", "mode": "quick" }`, plus `lead: { name, email, phone, consent: true, consent_text_version, source: "landing" }` when the visitor left contacts and consented. If an older parser rejects those fields, the BFF retries without `lead`, then with `{ "url" }` only.
3. Polls: `GET {BASE}/api/scans/{scan_id}` until `phase` ∈ `done|error|blocked`
4. PDF: `GET {BASE}/api/scans/{scan_id}/pdf` (only from the BFF)

All parser fetches send `ngrok-skip-browser-warning: true` so free ngrok tunnels work from Vercel/Node (no browser interstitial).

Phases: `queued|open|extract|rules|pdf` (+ terminal). Landing risks = `push===true` OR `findings.length>0` when `phase===done`.

Without a public `PARSER_API_BASE` the site uses a polished mock parser.

Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`): every finished landing scan («Новый клиент с лендинга»: domain, score, risks yes/no, findings, contacts, link) plus new-lead alerts. PDF `sendDocument` only when `pdf_ready` and the scan has risks. Missing Telegram env is a logged skip, not a crash.

Public without the service bearer: `GET {BASE}/api/health` and `POST {BASE}/public/lead`. The browser never calls the parser.

### `POST /api/leads` origin and client IP

`ALLOWED_ORIGINS` is a comma-separated list of exact `Origin` values: the production site and each Vercel preview origin (`https://persdannye.ru,https://<preview>.vercel.app`). There is no wildcard. A missing `Origin`, the value `null`, any other host, and a lookalike such as `https://persdannye.vercel.app.evil.com` get **403**. Local dev needs `http://localhost:3000` in that list.

When `PARSER_API_BASE` is set, an accepted lead is forwarded **once** to `POST {BASE}/public/lead` (contract v1.1, no service bearer, no `smart_token`). The JSON body is at most 16 KB: `name` (2–120), `email` (≤200) and/or `phone` (≤40), optional `url`, `check_id`, `message`, `source`, and `consent: { accepted: true, text_version: "2026-10-11-lead" }`. `marketing_consent: { accepted: true, text_version: "2026-10-11-marketing" }` is included only when the lead has an email and the checkbox is on. The browser sends one `Idempotency-Key` (UUID) per form fill; the BFF forwards it unchanged. A missing or invalid key is **400** `idempotency_key_invalid`. A manual resubmit reuses the same key. Neither the browser nor the BFF retries a lead automatically.

Parser statuses are returned with the same `error`: **201**; **400** `validation_failed` plus `fields`; **409** `idempotency_in_progress`; **422** `idempotency_key_reused`, `consent_required`, or `consent_version_unknown`; **429** with `Retry-After`; **503** (any `error`, including `rate_limit_unavailable`) with `Retry-After` when the parser sent it. A 503 leaves the typed fields in the form and shows «Не удалось отправить заявку, попробуйте через несколько минут». When `Retry-After` is delay-seconds or an HTTP-date, that sentence uses «попробуйте через ~N мин». The form does not submit again by itself.

The client address comes from the Vercel header `x-real-ip`, or from the first address in `x-vercel-forwarded-for`. A client-supplied `X-Forwarded-For` is ignored. Every client-supplied `X-PD-*` header is removed before the parser request is built.

`PD_BFF_SIGNING_SECRET` (at least 32 bytes) is the HMAC key. The same signature is attached to **every** BFF call to the parser that has a Vercel client address (lead, login, scan, PDF). The headers are:

- `X-PD-Client-IP` — the raw Vercel address
- `X-PD-Ts` — unix seconds, `Math.floor(Date.now() / 1000)`, read immediately before that fetch and not cached. The parser accepts the signature only within ±60 seconds
- `X-PD-Sig` — hex HMAC-SHA256 (`node:crypto`) of `<ts>.<METHOD>.<pathname>.<ip>`. METHOD is uppercased. The path is the parser request pathname, not the Vercel route: a lead signs `/public/lead`, never `/api/leads`. Query, fragment, and a trailing slash are omitted, so `/public/lead/` and `/public/lead?x=1` both sign as `/public/lead`. Example: `1760817600.POST./public/lead.203.0.113.7`

A missing or shorter secret omits those three headers outside production. In production (`VERCEL_ENV=production` or `PD_DEPLOY_ENV=prod`) the BFF does not call the parser and responds **503** with no secret details. A parser **429** is returned unchanged, including `Retry-After`. Lead names, emails, and phones are not written into HTTP responses or server logs. An address that is logged has its last IPv4 octet (or IPv6 interface id) cleared.

## Deploy

Vercel Production (`VERCEL_ENV=production`):

- Do not set `E2E`, `SUPPRESSION_MOCK`, or `OUTBOUND_MOCK` when `VERCEL_ENV=production` or `PD_DEPLOY_ENV=prod`. Any non-empty value stops that build. The check does not read `NODE_ENV`, so a local build and CI still succeed when `NODE_ENV=production` and neither flag is set. `E2E=1` alone is allowed.
- `ALLOWED_ORIGINS` and `PD_BFF_SIGNING_SECRET` are required. The signing secret must be at least 32 bytes. An empty or shorter value stops that build the same way a mock variable does.

Preview may keep the mock variables. They are not copied into Production. On the VPS, set `PD_DEPLOY_ENV=prod`.

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
