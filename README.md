# Moose Dashboard

Read-only web dashboard over the Innovera Moose Tracker Google Sheet. See [Claude-v1.md](./Claude-v1.md) for the full spec.

## Stack
Next.js 15 (App Router) · TypeScript · Tailwind · Supabase · Google Sheets API · NextAuth (Google SSO) · Vercel

## Quick start (local)

```bash
pnpm install
cp .env.example .env.local
# fill in .env.local (see "Credentials" below)

# run the schema against your Supabase project once:
#   supabase/migrations/0001_init.sql
#   supabase/seed/people.sql

pnpm dev
# open http://localhost:3000
```

Tests:
```bash
pnpm test        # Vitest unit tests for normalization
pnpm typecheck
pnpm build
```

## Credentials (what Harry needs to provide)

| Env var | How to get it |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Create a service account in Google Cloud → IAM & Admin → Service Accounts. Enable the Sheets API on the project. Create a JSON key, paste the entire JSON into this env var. Share the Moose sheet with the service account's `client_email` as Viewer. |
| `MOOSE_SHEET_ID` | The ID in the sheet URL: `docs.google.com/spreadsheets/d/<SHEET_ID>/edit` |
| `PLANNING_GID` | The `gid=` value in the URL when the Planning tab is active |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Create a new Supabase project → Settings → API |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud → APIs & Services → Credentials → OAuth 2.0 Client. Add `http://localhost:3000/api/auth/callback/google` and your Vercel URL to authorized redirect URIs. Restrict to `hd=innovera.ai`. |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `CRON_SECRET` | Any long random string. Vercel cron will send it as `Authorization: Bearer $CRON_SECRET`. |
| `JIRA_BASE_URL` | Default is `https://innovera.atlassian.net/browse` — confirm. |

## Deploy

1. Push to a Vercel project.
2. Add every env var above as a production env var.
3. Vercel Cron reads `vercel.json` — it'll hit `/api/cron/sync` every 5 minutes.
4. Run the Supabase migration + seed (via the Supabase SQL editor, one time).

## One-time Supabase setup

Paste in order into the Supabase SQL editor:
1. `supabase/migrations/0001_init.sql`
2. `supabase/seed/people.sql`

## Architecture

```
Google Sheet
   │ 5-min poll + manual Refresh
   ▼
lib/sheets/adapter.ts ── normalize (lib/normalize/*)
   │
   ▼
Supabase (planning_items, experiments, releases, sync_log, people, name_aliases)
   │
   ▼
Next.js Server Components (app/*)
   │
   ▼
User's browser (authed via Google SSO, innovera.ai only)
```

Sheet wins. Cache is disposable. UI never writes to the cache directly.

## Open TBDs (marked in-code)

- **`NEXT_PUBLIC_*` vs server-only env for sheet ID**: today the deep-link to Google Sheets is built inside a server component using `MOOSE_SHEET_ID`/`PLANNING_GID`. If you later need client-side deep-link generation, add `NEXT_PUBLIC_` mirrors.
- **Rank-score tiers**: current UI shows the raw rank number. Daniel to confirm whether to visualize cutoffs (e.g. top/middle/low).
- **`Max` vs `Maksym`**: aliases in `supabase/seed/people.sql` treat them as the same person. Flag in UI if wrong.
- **Branding palette**: Tailwind config has a muted placeholder palette in `tailwind.config.ts`. Swap in the exact client-onboarding values.

## Layout

```
app/
  page.tsx            Overview
  items/page.tsx      Items list
  kanban/page.tsx     Kanban
  release/page.tsx    By release
  blocked/page.tsx    Blocked
  owners/page.tsx     By owner
  subsystems/         By subsystem
  experiments/        Experiments kanban
  item/[id]/          Full-page item detail
  @drawer/(.)item/    Intercepting route — drawer over any list
  api/
    cron/sync/        Cron target (Bearer $CRON_SECRET)
    refresh/          Manual refresh (authed POST)
    health/
    sync-status/      Powers LastSynced footer + banner
    auth/[...nextauth]/

lib/
  sheets/adapter.ts   Pull from Google Sheets
  normalize/          Status, owners, links, dates, parentEpic, experiments
  sync/run.ts         Orchestrator (adapter → normalize → Supabase)
  queries/            Supabase read helpers for server components
  supabase/           Server + service-role clients
  auth.ts             NextAuth config
  types.ts            Shared Zod/TS types
  format.ts           Date helpers
  utils.ts            cn()
  env.ts              Guarded env getters

components/
  layout/             AppShell, Header, SideNav, LastSyncedFooter, SyncBanner
  items/              ItemCard, ItemDetail, StatusDot, TypeBadge, FilterBar
  drawer/DrawerShell
  refresh/RefreshButton
  search/GlobalSearch
  auth/SignOutButton
```
