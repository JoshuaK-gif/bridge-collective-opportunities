# Bridge Collective Opportunities (BCO)

Opportunity discovery platform connecting youth across Uganda and East Africa to jobs,
scholarships, grants, fellowships and training — [bridgecollectiveopport.org](https://www.bridgecollectiveopport.org).

## Architecture

| Layer | Where | Notes |
| --- | --- | --- |
| Frontend | `src/` (React + Vite SPA) | Code-split per route; served from `dist/` |
| API | `api/` (Vercel serverless functions) | `_`-prefixed files are shared helpers, not routes |
| Database | Nhost Postgres | Schema history in `migrations/` |
| Auth | Nhost Auth | Browser signs in directly; API verifies the token |
| Media | Cloudinary | Browser uploads directly with a server-signed signature |
| Mobile | Capacitor | `npm run build:mobile` / `build:android` / `build:ios` |

**Auth flow:** the browser posts credentials to Nhost Auth and stores the returned access
token. Every API call sends it as `Authorization: Bearer …`; `api/_auth.js` verifies the
signature against Nhost's JWKS, then maps the account to a row in the app's `users` table —
that row is the source of `role` (and therefore of admin access). `api/_tests` covers the
email-notification path.

## Local development

```bash
npm install
cp .env.example .env      # VITE_NHOST_AUTH_URL is enough to run the UI
npm run dev               # http://localhost:5173
```

The `api/` functions need `DATABASE_URL` to return data. Either `vercel dev` with `.env`
populated, or point the frontend at a deployed environment.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run typecheck` | `tsc` over the JS via `jsconfig.json` |
| `npm run test:api` | Node test runner over `api/_tests` |
| `npm run build:mobile` | Build then `cap sync` for the native shells |
| `node scripts/check-prod-status.mjs` | Reads SMTP/newsletter/reminder/subscriber state from the database (needs public DB access) |

## Control panel

`/admin-bridgejobs` is admin-only: `AdminRoute` requires an authenticated user whose `role`
is `admin`. Sign in at `/login` with a Nhost Auth account that also has a matching `users`
row — the email must match. `migrations/031_nhost_auth_mapping.sql` adds the `nhost_id`
mapping column and creates/promotes the admin row.

Authenticated requests fail if the database is unreachable, so if sign-in succeeds but the
panel bounces you back, check `/api/auth/me` first.

## Deployment

Vercel builds the SPA and serves `api/` as serverless functions (`vercel --prod`, or the Git
integration on push). Required env vars are documented in `.env.example`; `DATABASE_URL` is
mandatory and the Nhost database must have **Public Access** enabled. Live API endpoints
expose a `/api/health` check, and `.github/workflows/keepalive.yml` pings it every five
minutes so the database stays awake.

## Database

`migrations/*.sql` mirror the schema applied to the Nhost database (managed through the Nhost
dashboard/SQL editor). `new_nhost_setup.sql` is the full baseline; later numbered files are
incremental changes.
