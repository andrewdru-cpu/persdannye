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
- `GET /api/checks/[id]` → status / findings (poll every 2–3s)
- `POST /api/leads` → lead with required consent

When `PARSER_API_BASE` is set, the BFF:

1. Authenticates with `PARSER_API_EMAIL` + `PARSER_API_PASSWORD` via `POST {BASE}/api/auth/login` (JWT cached server-side), **or** uses `PARSER_API_TOKEN` as Bearer
2. Creates scan: `POST {BASE}/api/scans` `{ "url" }` → `{ scan_id, queued, warning }`
3. Polls: `GET {BASE}/api/scans/{scan_id}` until `phase` ∈ `done|error|blocked`

Phases: `queued|open|extract|rules|pdf` (+ terminal). Landing risks = `push===true` OR `findings.length>0` when `phase===done`.

Public without auth on parser: `GET {BASE}/api/health` only.

## Company / legal

Edit `lib/company.ts` (INN, OGRN, address, emails, phone).

Routes: `/privacy`, `/cookies`, `/terms`, cookie banner (necessary / analytics / marketing), consent checkbox on lead forms.

## Cabinet MVP

`/cabinet` lists leads from `data/leads.json` (no auth — local only).

## Russian README

See `README_RU.md`.
