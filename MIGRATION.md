# Migration: BCO → Nhost free tier (Functions + Postgres) + Vercel (frontend)

## Final decision (user-confirmed)

- **Backend** runs on the **Nhost free tier** as consolidated Functions, **without AI**, **without GrantKit (BCO Grant Assistant)**, and **without PDF generation** — those need compute/containers the free tier doesn't provide.
- The AI / GrantKit / PDF **code stays in this repo** (GitHub) — it's just not deployed on Nhost. Feature flags (`GET /v1/health` → `features`) let the frontend hide those sections.
- **Database**: Nhost managed Postgres (free 1 GB) — ✅ migrated (schema + seed).
- **Frontend**: Vercel (free) — config ready, deploy pending.

## Why AI/GrantKit/PDF are off on Nhost

| Feature | Free-tier blocker |
|---|---|
| AI calls (grant-write, enrich, scraper rewrite/image) | 10s function timeout (free); needs 30–120s |
| GrantKit (Python CLI) + Playwright PDF | Native code — Functions are JS-only; containers (Nhost Run) are paid (~$15/mo) |

These remain in the repo; if the project later moves to Nhost Pro (180s timeout, paid Run) or hosts AI on Supabase free (150s wall-clock), they can be re-enabled.

## Nhost Functions map (9 of the 10 free-tier cap)

| Function | Endpoint | Resources |
|---|---|---|
| `health` | `GET /v1/health` | status + DB + `features { ai:false, grantAssistant:false, pdf:false }` |
| `auth` | `POST /v1/auth`, `GET /v1/auth?action=me` | login (bcrypt + JWT), profile |
| `content` | `GET/POST /v1/content` | opportunities (list/get/CRUD/bulk/submit), categories, news, related, check-duplicates, unsubscribe |
| `collections` | `GET/POST /v1/collections` | lists (+items), templates, resumes |
| `admin` | `GET/POST /v1/admin` | settings, subscribers, messages, **Cloudinary upload signatures** |
| `outreach` | `GET/POST /v1/outreach` | newsletter (send/test/status), reminders (create/process) |
| `scraper` | `GET/POST /v1/scraper` | feed preview, posts, logs, drafts (edit/publish/republish/delete), webhook, social post — AI steps return 501 |
| `seo` | `GET /v1/seo?type=sitemap\|rss` | sitemap.xml + rss.xml |
| `cron` | `POST /v1/cron/:job` | scheduled-publish, expired-cleanup, newsletter (batched), reminders — auto-publish returns 501 |

Notes:
- Static routes only → IDs are **query params** (`?id=`, `?token=`, `?slug=`, `?key=`) or `{ resource, action }` POST bodies. `src/api/client.js` must be updated to this scheme.
- **Uploads**: Nhost Functions can't reliably receive multipart, so uploads became **direct-to-Cloudinary browser uploads** — the client fetches a signed upload URL from `admin` (`action: 'signature'`) and POSTs the file to Cloudinary itself.
- **Newsletter** is **batched** (50 per invocation) to stay under the 10s timeout; cron workflow passes `?offset=` for chunked runs.
- **Cron cadence** on GitHub Actions is 5-min minimum; Nhost free quota (1 GB-hour/month) also argues for 5–15 min runs, not the old 1–2 min.
- Shared code lives in `functions/_shared/` (underscore = not routed). Ports of: db, auth, errors, logger, cache, validate (zod), url-validator, audit, email, social, cloudinary, scraper (LLM fallback removed), newsletter, reminders.

## Status

| Phase | Status |
|---|---|
| 0. Nhost project + creds | ✅ `ybgaidcwksqeuojraxoe` / `ap-southeast-1`; creds in `server/.env.nhost` (gitignored) |
| 1. Database on Nhost | ✅ schema (migrations 001–029 + seed) applied; missing indexes fixed (pg_trgm, audit_log, title trgm) |
| 2. API → Functions | ✅ 9 functions written + `scripts/smoke-functions.mjs` — **17/17 pass against live Nhost DB** |
| 3. Frontend → client.js | ✅ rewritten to query-param scheme; direct-to-Cloudinary uploads; feature-flag AI/Grant UI off |
| 4. Auth → Nhost Auth | ✅ frontend signs in at Nhost Auth; functions verify Nhost JWTs (NHOST_JWT_SECRET auto-injected) and map by email |
| 5. Deploy functions | ⬜ `nhost init --remote`, connect GitHub repo (functions deploy on push), set env vars |
| 6. Vercel deploy | ⬜ pushed to GitHub ✓; deploy via Vercel (project `bridge-collective-nhost`) |
| 7. Cron | ⬜ add `NHOST_FUNCTIONS_URL` + `CRON_SECRET` to GitHub Actions secrets |

## Env vars to set on Nhost (dashboard)

`DATABASE_URL` (already set), `NHOST_JWT_SECRET` (auto-injected for functions), `CRON_SECRET`, `SITE_URL`, `WEBHOOK_SECRET` (if scraper webhook is used), `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`.

> Nhost Auth: create the admin user in the Nhost dashboard (Auth → Users → Add user) with the same email as the app's `users` row (`kamulegeyajoshua534@gmail.com`) so role mapping works.

## Removed from the Nhost deployment (kept in repo)

- `server/routes/ai.js`, `lib/enrich.js`, `lib/rewriter.js` (AI)
- `server/routes/grantkit.js`, `lib/grantkit.js`, `engine/` (GrantKit — the engine container is still useful if Nhost Run is ever enabled)
- `server/routes/cv-pdf.js`, `lib/cv-pdf.js` (PDF)
- Scraper AI steps (`process`, `process-all`, `draft-enrich`) → 501
- Custom login (bcrypt + JWT_SECRET) replaced by Nhost Auth; `functions/auth/index.js` now resolves Nhost tokens to the app user (role) only. **Function files are `functions/<name>/index.js` (Nhost file-based routing: `functions/auth/index.js` → `/v1/auth`).**
