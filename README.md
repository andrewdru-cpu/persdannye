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

- `POST /api/checks` `{ "url": "https://…" }` → check job
- `GET /api/checks/[id]` → status / findings (poll every 2–3s); on `done` with risks, BFF notifies Telegram
- `GET /api/checks/[id]/pdf` → server-side PDF proxy (parser Bearer never reaches the browser)
- `POST /api/leads` → lead with required consent + Telegram notify

When `PARSER_API_BASE` is set, the BFF:

1. Authenticates with `PARSER_API_EMAIL` + `PARSER_API_PASSWORD` via `POST {BASE}/api/auth/login` (JWT cached server-side), **or** uses `PARSER_API_TOKEN` as Bearer
2. Creates scan: `POST {BASE}/api/scans` `{ "url" }` → `{ scan_id, queued, warning }`
3. Polls: `GET {BASE}/api/scans/{scan_id}` until `phase` ∈ `done|error|blocked`
4. PDF: `GET {BASE}/api/scans/{scan_id}/pdf` (only from the BFF)

Phases: `queued|open|extract|rules|pdf` (+ terminal). Landing risks = `push===true` OR `findings.length>0` when `phase===done`.

Without a public `PARSER_API_BASE` the site uses a polished mock parser.

Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`): scan-risk alerts (text + PDF `sendDocument`) and new-lead alerts. Optional `TELEGRAM_NOTIFY_ON_CLEAN=false`.

Public without auth on parser: `GET {BASE}/api/health` only.

## Company / legal

Edit `lib/company.ts` (INN, OGRN, address, emails, phone).

Routes: `/privacy`, `/cookies`, `/terms`, cookie banner (necessary / analytics / marketing), consent checkbox on lead forms.

## Cabinet MVP

`/cabinet` lists leads from `data/leads.json` (no auth — local only).

## Russian README

See `README_RU.md`.
