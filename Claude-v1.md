# Moose Dashboard — CLAUDE.md

A read-only web dashboard over the Innovera Moose Tracker (Google Sheet). Turns a 93-row, 23-column cross-functional planning sheet into something the C-suite can actually use.

Owner: Harry (Head of Special Projects). Requested by: Daniel (CRO). Primary readers: Pedram (CEO), Spencer (CPO, sheet owner), Jeff (CTO), Daniel.

---

## 1. Scope

### In V1 (ship first)
- Read-only dashboard over Planning + Experiments tabs
- 5-min polling refresh from Google Sheets → Supabase cache, plus manual "Refresh" button
- Google SSO (Workspace). Everyone who signs in sees everything.
- One shared overview landing page; persona views expressed as URL-state filters
- Deep-link "Open in Sheet" on every row

### In V1.5 (next)
- Chat over the tracker (read-only Q&A via tool calls)
- "New item" form that writes a single row to Planning via Sheets API
- One-time sheet data normalization pass with Spencer (merging the two Categories/Subsystems enum lists)

### In V2 (later)
- In-line edit with optimistic concurrency + row-hash conflict detection
- Expert agent: rules engine over the table + LLM explanation layer
- Jira integration: resolve `PRMT-*` / `INV-*` links inline
- Project Mono integration as an agent tool

### NOT doing
- Row-level permissions, audit logs beyond basic access, burndown charts, Gantt, custom dashboards per user, email digests (all V2+ if at all)
- Rebuilding the broken `Now` / `Next` / `By Owner` / `By Subsystem` sheet tabs — the webapp replaces them. Leave them in the sheet; ignore in the adapter.
- Touching the `Temp - GenOps Mapping` and `Temp - Mapping Details` tabs in V1.

---

## 2. Architecture

```
Google Sheet (source of truth)
       │ 5-min poll (Vercel Cron) + manual trigger
       ▼
Supabase (Postgres cache + normalized schema)
       │ RLS: authenticated users only, read-all
       ▼
Next.js App Router (Vercel) ── Google SSO (NextAuth / Auth.js)
       │
       ▼
Exec's browser
```

**Principles**:
- **Sheet wins.** Any conflict between sheet and Supabase resolves toward the sheet. Cache is disposable; we can nuke and rebuild from Sheets any time.
- **Poll-pull, not webhook.** Sheets webhooks are flaky and require Apps Script glue; 5-min poll is simpler and meets the spec.
- **Supabase is a read cache for V1.** Do not let the UI write to it directly. V1.5's "new item" write goes Sheet → cache refresh, NOT cache → Sheet.
- **Normalization happens at write-to-cache time**, not at UI render time. The UI trusts the cache is clean.

---

## 3. Tech stack

- **Framework**: Next.js 15 (App Router), TypeScript, React Server Components where it makes sense
- **Styling**: Tailwind + shadcn/ui (match existing Innovera client-onboarding branding — pull colors/fonts from that repo)
- **DB**: Supabase (Postgres)
- **Auth**: NextAuth / Auth.js with Google provider, restricted to `@innovera.com`
- **Sheets**: `googleapis` npm package, service account with read access to the sheet
- **Deployment**: Vercel
- **Cron**: Vercel Cron Jobs, `*/5 * * * *` → `/api/cron/sync`
- **Model provider (for V1.5 chat later)**: OpenRouter (already in use internally)
- **Icons**: Lucide
- **Data fetching in client**: SWR for refresh-on-focus + manual `mutate()` from the Refresh button

House conventions to mirror from existing Innovera internal tools:
- Branded header with Innovera logo + page title
- Muted, professional palette (no neon)
- Error boundaries on every route
- `/api/health` endpoint

---

## 4. Data model

### 4.1 Planning tab — raw schema (read by column index, not header)

Column 3 is unlabeled in the sheet but contains Release. Read by index.

| Col | Sheet header | Our field | Type | Notes |
|-----|-------------|-----------|------|-------|
| 1 | (numeric, e.g. "97") | `id` | int | Monotonically-increasing row counter. Unique. |
| 2 | Name | `name` | text | |
| 3 | *(blank)* | `release` | text \| null | Values: `R14`, `R15`, `R16.1`, `R16.2`, `R17`, `R18`. Read by column index. |
| 4 | Seq | `seq` | text \| null | Priority ordering like `1.1`, `1.61`, also `?`. Keep as string. |
| 5 | Status | `status_raw` | text | See normalization §4.3 |
| 6 | Type | `type` | text \| null | `Epic`, `Story`, `Task` |
| 7 | Category | `category` | text \| null | |
| 8 | Subsystem | `subsystem` | text \| null | |
| 9 | Parent/Epic | `parent_epic` | text \| null | **Text not ID.** Fuzzy match only. |
| 10 | Links | `links_raw` | text \| null | Comma-separated Jira/graph IDs: `PRMT-7`, `INV-1836`, `G7.5`, `1763.0`, etc. |
| 11 | Rank Score | `rank_score` | int \| null | Pre-computed: `P*100 + I*10 + D`. Lower = higher priority. |
| 12 | Priority (P) | `priority` | int \| null | 1 = High, 3 = Low |
| 13 | Impact (I) | `impact` | int \| null | 1 = High, 3 = Low |
| 14 | Experiments | `experiments_raw` | text \| null | Comma-separated refs to Experiments tab |
| 15 | Difficulty | `difficulty` | int \| null | 1 = Easy, 4 = Hard |
| 16 | R (Responsible) | `r_raw` | text \| null | Freetext first names. See §4.3 owner resolution. |
| 17 | A (Accountable) | `a_raw` | text \| null | Same. |
| 18 | D (Definer) | `d_raw` | text \| null | Same. |
| 19 | Due Date | `due_date` | date \| null | |
| 20 | Comments | `comments` | text \| null | |
| 21 | Definition of Done | `dod` | text \| null | |
| 22 | Blocker | `blocker` | text \| null | |
| 23 | Blocked Since | `blocked_since` | date \| null | |
| 24 | Is Ready? (auto) | `is_ready` | bool \| null | Sheet-computed. Trust it. |

**Skip rows where `name` is null or empty.** The sheet has ~950 trailing empty rows.

### 4.2 Experiments tab — raw schema

8 real columns, ~31 non-empty rows.

| Col | Sheet header | Our field | Notes |
|-----|-------------|-----------|-------|
| 1 | Key | `key` | Jira-like: `PRMT-7`, `PRMT-76`, or freetext like `"Create Jira Ticket"`, `"Not Tracked by Us"`, `"Backlog"` |
| 2 | Problem to Solve (Moose Board Item) | `problem` | Links back to Planning by name (fuzzy). |
| 3 | Experiment | `experiment` | |
| 4 | Individual Experiment Question | `question` | |
| 5 | Scope | `scope` | |
| 6 | Details/Additional Notes | `details` | |
| 7 | Status | `status_raw` | See normalization — **dirty**. |
| 8 | Notes | `notes` | |

### 4.3 Normalization rules

Run these at cache-write time. Store both raw and normalized fields.

**Status (Planning)** — vocab is already clean, just trim whitespace. Canonical values:
```
0-Done, 0-Blocked, 0-?, 1-InDev, 1-InDevPrompt,
2-ReadyForDev, 3-Discovery, 3-Design, 4-Experiment, 5-Backlog
```
Also observed on data: `In Progress`, `Ready`. Map to `1-InDev` and `2-ReadyForDev`. Log the mapping so Spencer can see drift.

**Status (Experiments)** — genuinely dirty. Normalize to the Planning vocab:
```
"Done V1"        → 0-Done
"Done"           → 0-Done
'"Done"'         → 0-Done   (yes, quoted)
"Done-ish"       → 0-Done
"Blocked"        → 0-Blocked
"blocked"        → 0-Blocked
"QA"             → 1-InDev  (QA is in-progress work)
"Ready for Dev"  → 2-ReadyForDev
"Backlog"        → 5-Backlog
null             → 5-Backlog  (with warning)
```
Store original in `status_raw`, normalized in `status`. UI shows normalized; detail drawer shows raw + a small "Spencer will clean this up" footnote.

**Owners (R / A / D)** — freetext first names, sometimes combined with `/`.

Resolution:
1. Split on `/` → list of names. `"Pedram/Dan'l"` → `["Pedram", "Dan'l"]`
2. Normalize spelling: `Dan'l` → `Daniel`, `Maks` → `Maksym`, `Max` → `Maksym` (confirm with Harry — might be two different people), `AnnaH` → `Anna H.`, `Hanna` stays. Keep a hand-maintained `name_aliases` table in Supabase.
3. Map to `@innovera.com` email via a `people` table (seed from employee list).
4. Known canonical list (V1 seed): `Pedram, Spencer, Jeff, Daniel, Harry, Felipe, Maksym, Olga, Vika, Carson, Anna H., Hanna, Nobu`.

**Links** — split `links_raw` on comma, trim. Detect `^PRMT-\d+$` and `^INV-\d+$` and `^G\d+(\.\d+)?$` patterns. Store as array of `{id, type, raw}` where type ∈ `jira_prmt | jira_inv | graph | other`.

**Experiments cross-ref** — split `experiments_raw` on comma. Resolve against Experiments tab by `key`. Non-resolving refs stay as text.

**Parent/Epic** — do a case-insensitive substring match against `name` of other Planning rows where `type = 'Epic'`. Cache the resolution. If ambiguous or no match, store `parent_epic_resolved = null` but keep the text.

**Categories / Subsystems** — union the two enum lists from the Lists tab. Canonical sets for V1:

Categories: `Core Product, Quality & Reliability, Performance, Client Delivery, Compliance & Security, Self-Serve & Admin, Fundraising / Strategy, Infra / DevOps, Research / Exploration, Strategy, AI, Delivery, Product, Engineering`

Subsystems: `UI, Chat, Input, Generation, Guts, Claims, Language / i18n, Slides, Portfolio, Meta-docs, Prompts, Delivery, DevOps, Compliance, Admin, SSO, RBAC, Speed / Perf, UX, Artifact Generator, Proj. Instructions, SOT, FBM, System, Vault, HITL, Project Ins., Ingestion`

Values in the sheet that don't match are passed through as-is and surfaced in the filter dropdowns anyway (lowercase "comp." etc.). **Do not reject unknown values.** Do log them.

### 4.4 Supabase schema

```sql
-- Enums intentionally NOT used — we want to accept novel values gracefully
create table people (
  email text primary key,
  display_name text not null,
  aliases text[] default '{}'
);

create table planning_items (
  id int primary key,               -- from col 1
  name text not null,
  release text,
  seq text,
  status text not null,             -- normalized
  status_raw text not null,
  type text,
  category text,
  subsystem text,
  parent_epic text,                 -- raw text
  parent_epic_id int references planning_items(id),  -- resolved, nullable
  links jsonb default '[]'::jsonb,  -- [{id, type, raw}]
  rank_score int,
  priority int,
  impact int,
  difficulty int,
  experiments_refs jsonb default '[]'::jsonb,
  r_emails text[] default '{}',
  a_emails text[] default '{}',
  d_emails text[] default '{}',
  r_raw text,
  a_raw text,
  d_raw text,
  due_date date,
  comments text,
  dod text,
  blocker text,
  blocked_since date,
  is_ready boolean,
  row_hash text not null,           -- for V2 conflict detection
  synced_at timestamptz not null default now()
);
create index on planning_items (status);
create index on planning_items (release);
create index on planning_items (rank_score);
create index on planning_items using gin (r_emails);
create index on planning_items using gin (a_emails);

create table experiments (
  key text primary key,             -- may be synthetic if sheet key is null/generic
  sheet_row int not null,
  problem text,
  problem_planning_id int references planning_items(id),
  experiment text,
  question text,
  scope text,
  details text,
  status text not null,             -- normalized
  status_raw text,
  notes text,
  synced_at timestamptz not null default now()
);

create table releases (
  name text primary key,            -- R14, R15, R16.1 ...
  planned_staging date,
  revised_staging date,
  actual_staging date,
  planned_prod date,
  revised_prod date,
  actual_prod date
);

create table sync_log (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,             -- 'ok' | 'error' | 'partial'
  planning_rows int,
  experiments_rows int,
  normalization_warnings jsonb,
  error_message text
);

create table name_aliases (
  alias text primary key,
  canonical_email text references people(email)
);
```

For synthetic experiment keys when the sheet's `key` is null or generic ("Create Jira Ticket", "Backlog", "Not Tracked by Us"), use `exp_{sheet_row}`.

RLS: authenticated-only read on all tables; no write from client (service role only, used by the sync job).

---

## 5. Sheets adapter

Single module: `lib/sheets/adapter.ts`. Contract:

```ts
type SyncResult = {
  planning: PlanningItem[];
  experiments: Experiment[];
  releases: Release[];
  warnings: NormalizationWarning[];
};

export async function pullFromSheets(): Promise<SyncResult>;
export async function writeToPlanningBottom(row: NewPlanningItem): Promise<{ id: number }>;  // V1.5
```

Implementation notes:
- Read via `spreadsheets.values.get` with `valueRenderOption: 'UNFORMATTED_VALUE'` for dates (you get serials, parse to ISO), and `dateTimeRenderOption: 'FORMATTED_STRING'` is fine as fallback. Test both.
- Read ranges:
  - `Planning!A1:Y1041` (cap at max_row, ignore trailing empty)
  - `'Temp - Experiments Mapping'!A1:H1023`
  - `Releases!A1:G10`
  - `Lists!A1:R67`  (for enum discovery; optional — we seed from our hardcoded canonical sets)
- Read Planning with `headers=false` because col 3 is unlabeled. Map by index.
- Service account credentials in `GOOGLE_SERVICE_ACCOUNT_JSON` env var, share sheet with its email as Viewer (V1) / Editor (V1.5+).
- The sync writes to a shadow table (`planning_items_staging`), then swaps via transaction. Avoids partial states.
- Compute `row_hash = sha256(JSON.stringify(normalized_row))` for future conflict detection.

---

## 6. UI spec

### 6.1 IA

```
/                        Overview (default landing)
/items                   Full list, filterable
/kanban                  Kanban by Status
/release                 By Release
/blocked                 Blocked items, sorted by Blocked Since
/owners                  Grid: owner × status
/subsystems              Grid: subsystem × status
/experiments             Experiments tab (own kanban + list)
/item/:id                Detail drawer, opens over any page via intercepting route
/api/cron/sync           Vercel cron target
/api/refresh             Manual refresh trigger (POST, auth required)
/api/health
```

All list/kanban pages accept the same URL filter params: `?status=&category=&subsystem=&release=&owner=&type=&ready=`. Multi-select uses comma-separated values. URL is the state — bookmarkable, shareable.

### 6.2 Top-level layout

- Sticky header: Innovera logo, page title, global search input (typeahead on `name`), "Refresh" button (shows last-synced timestamp + "Refreshing…" state), user avatar menu
- Left nav: Overview, Items, Kanban, Release, Blocked, Owners, Subsystems, Experiments
- Filter bar under header on all list-type pages
- Item cards are uniform across views

### 6.3 Item card

```
┌────────────────────────────────────────┐
│ #97  [Epic]              R17   Rank 111 │
│ Project list - build (see also 56)      │
│ Core Product · Portfolio                │
│ R: Pedram   A: Spencer                  │
│ ● 1-InDev          Due Apr 29           │
│ ⚠ Blocked 14d                  [→ Sheet]│
└────────────────────────────────────────┘
```

- Type: colored badge (Epic = purple, Story = blue, Task = gray)
- Status: dot color (Done = green, Blocked = red, InDev = blue, Discovery = yellow, Backlog = gray)
- Rank: smaller, right-aligned
- Blocked warning appears only if `blocked_since` > 7 days OR `blocker` populated
- Due date: red if overdue, amber if within 7 days
- "→ Sheet" deep-links to `https://docs.google.com/spreadsheets/d/{sheetId}/edit#gid={planningGid}&range=A{rowNumber}` — requires adapter to track the sheet row number alongside `id`

### 6.4 Overview page (`/`)

Single scroll, four sections:

**1. At a glance** — 4 stat cards:
- Active items (status ∈ {1-InDev, 1-InDevPrompt, 2-ReadyForDev, 3-Discovery, 4-Experiment})
- Blocked items (status = 0-Blocked OR blocker populated)
- Due this week (due_date within 7 days, not done)
- Current release health: show R17 (or whatever's next non-done), slip days = revised_prod - planned_prod

**2. Blocked** — top 5 by `blocked_since` desc, with "See all" → `/blocked`

**3. This release** — kanban-lite (3 columns: ReadyForDev, InDev, Done) filtered to current release

**4. My queue** — if the logged-in user appears in r_emails OR a_emails OR d_emails on any items, show top 10 by rank_score. Otherwise hide the section entirely.

### 6.5 Kanban (`/kanban`)

Columns, left to right:
`5-Backlog → 3-Discovery/Design → 2-ReadyForDev → 1-InDev/InDevPrompt → 4-Experiment → 0-Done`
`0-Blocked` is a separate collapsed row at the top of the page, not a column.
`0-?` rolls up into Backlog with a ? icon.

Drag is **disabled** in V1. Each card is a link to the detail drawer.

### 6.6 By Release (`/release`)

Columns = releases in order: `R14, R15, R16.1, R16.2, R17, R18`, then an "Unassigned" column. Cards grouped by status within each column (Done at bottom, collapsed).

Header for each column shows: Release name, planned prod date, revised prod date, actual prod date, slip days. Visually emphasize any release with items not done and planned date in the past.

### 6.7 Blocked (`/blocked`)

Flat list sorted by `blocked_since` desc. Each row: ID, name, blocker text, blocked since date, days stuck, owner, link to item detail.

### 6.8 By Owner (`/owners`)

Grid. Rows = people (union of r_emails, a_emails, d_emails, plus an "Unassigned" row). Columns = `InDev | ReadyForDev | Discovery | Blocked | Backlog | Done (30d)`. Cell = count, clickable → filtered list.

### 6.9 By Subsystem (`/subsystems`)

Same grid shape but rows = subsystems.

### 6.10 Experiments (`/experiments`)

Mirror of Kanban but on experiments data. Card is simpler: key, experiment name, normalized status, problem (text + link to planning parent if resolved).

### 6.11 Item detail drawer (`/item/:id`)

Opens as a right-side drawer via intercepting routes (so the underlying list stays visible). Shows all 24 fields, with these special sections:

- **Links** — rendered as clickable chips, PRMT-* and INV-* link out to Jira (URL pattern TBD — placeholder `#` for V1, confirm with Harry)
- **Experiments** — resolved rows from the Experiments tab, each a mini-card
- **Parent** — if `parent_epic_id` resolved, link to that item
- **Children** — planning items whose `parent_epic_id` = this item's id
- **Raw data (collapsed)** — show `status_raw`, `r_raw`, etc. for transparency during the dirty-data period
- **Open in Sheet** button — deep link as above

---

## 7. Refresh UX

- Footer of sidebar shows "Last synced: 2m ago" (relative, updates every 30s)
- Refresh button in header. Click → POST `/api/refresh` → triggers a sync → SWR `mutate()` on all list queries → toast "Updated"
- If the sync is already running, the button shows a spinner and the POST is a no-op (idempotent)
- Sync failure: toast with error, fall back to last good cache. Display a persistent banner "Sync failing since {time}" if more than 2 consecutive failures.
- Do NOT block the UI on refresh. Reads always serve from cache.

---

## 8. Auth

- NextAuth with Google provider
- Restrict to `hd=innovera.com` on the OAuth request (Google's hosted-domain param)
- Also hard-check `session.user.email.endsWith('@innovera.com')` server-side
- Middleware: redirect unauthenticated requests to `/api/auth/signin`
- `people.email` is the join key — the logged-in email is matched against `r_emails` etc. for "My queue"
- No roles in V1. Everyone sees everything.

---

## 9. V1.5 — chat + new-item write (preview, do not build in V1)

### 9.1 Chat architecture (for later)

- Route: `/chat`
- Model provider: OpenRouter
- Candidate models to A/B: Mistral Small 3.x, Claude Haiku 4.5 — pick after testing against real queries
- The LLM does not see the table. It sees a tool surface:
  ```
  list_items(filter) -> PlanningItem[]
  get_item(id) -> PlanningItem
  who_owns(subsystem|category) -> string[]
  whats_ready_for(owner_email) -> PlanningItem[]
  whats_blocked() -> PlanningItem[]
  release_status(name) -> Release & stats
  ```
- Session-only memory. No persistence in V1.5.
- System prompt locks it to "answer only from tool results, never speculate about items not returned."

### 9.2 New-item form

- Button in header: "+ New item"
- Form fields = canonical enums (Status/Type/Category/Subsystem from Supabase), name/priority/impact/difficulty (auto-computes rank_score), owner dropdowns from `people` table, optional due date and DoD
- Submit → append row to Planning via `values.append`
- Optimistic UI: insert into local cache with a pending flag; reconcile on next sync
- No edit, no delete in V1.5

---

## 10. V2 — expert agent (preview only)

Rules engine over the normalized cache, LLM only for prose generation. Rule candidates:
- Priority inversion: item has high rank but blocker has low rank
- Orphan Epic: Epic with 0 resolved children
- Stale blocked: `blocked_since` > 14d with no comment updated in last 7d
- Release risk: release `actual_prod` null, `revised_prod` in past, items not done
- Missing ownership: status = 1-InDev, r_emails empty
- Cross-tab drift: experiment done, parent planning item still Backlog
- Transitive block: item's linked Jira ticket is Blocked

Output: morning brief as Markdown, emailed to subscribers; findings also surfaced in-app with 👍/👎 feedback. Feedback tunes rule thresholds per user.

---

## 11. Open TBDs

Decide during implementation; don't block on them:

- `sheetId` and `planningGid` → Harry to provide via env var `MOOSE_SHEET_ID` and `PLANNING_GID`
- Jira base URL for `PRMT-*` and `INV-*` deep links → confirm with Harry (likely `https://innovera.atlassian.net/browse/{KEY}`)
- Exact shade palette for Innovera branding — copy from existing client-onboarding repo
- `Max` vs `Maksym` in the owners list — are these the same person? Default to yes; flag in UI if wrong
- Whether `Rank Score` of 111 vs 213 vs 303 has hard cutoffs for "top", "middle", "low" tiers the UI should visualize — ask Daniel
- Daylight saving edge cases on the cron schedule — cron runs UTC; acceptable staleness window absorbs this

---

## 12. Conventions

- Package manager: pnpm
- Path aliases: `@/` → project root
- Server components by default; `'use client'` only where state or handlers require it
- Zod schemas for every API boundary and for the sheet→normalized transform
- One server action per write (`app/actions/create-item.ts`), no REST handler for writes unless V2 requires it
- Test: Vitest for pure normalization logic (status mapping, owner resolution, hash). No e2e in V1 — not worth it at this scope. Hand-test the dashboard.
- Env vars required:
  ```
  GOOGLE_SERVICE_ACCOUNT_JSON     (raw JSON string)
  MOOSE_SHEET_ID
  PLANNING_GID
  JIRA_BASE_URL                    (V2, optional in V1)
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  NEXTAUTH_SECRET
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  ```
- Logging: Vercel logs are fine for V1. Structured logs (JSON) for the sync job so we can grep normalization warnings.
- Error handling: every server action returns `{ ok: true, data } | { ok: false, error }`. Never throw across the boundary.

---

## 13. Milestones (suggested)

| Milestone | Scope |
|-----------|-------|
| M1 — Sheets → Cache | Adapter + normalization + Supabase schema + cron. Confirm via SQL that 93 planning + 31 experiments rows land clean. |
| M2 — Shell + auth | Next.js scaffold, SSO, layout, nav, empty pages routed |
| M3 — Read views | Overview, Items, Kanban, Blocked. Item detail drawer. |
| M4 — Derived views | Release, Owners, Subsystems, Experiments |
| M5 — Polish | Empty states, loading skeletons, error boundaries, refresh UX, responsive tweaks |
| M6 — Demo to Daniel | Show it working; collect feedback before V1.5 work begins |

Target: M1–M5 in ~2 weeks of focused work. M6 same week as M5.

---

## Appendix A: Enums found in the sheet (Lists tab)

Kept as reference. Canonical sets above supersede these where there's overlap.

**Statuses** (col A, rows 2–11):
`0-Done, 0-?, 0-Blocked, 1-InDev, 1-InDevPrompt, 2-ReadyForDev, 3-Discovery, 3-Design, 4-Experiment, 5-Backlog`

**Types** (col A, rows 17–18):
`Epic, Task` *(Story exists in data but is missing from this list — add it to canonical)*

**Categories (old list, col A, rows 21–29)**:
`Core Product, Quality & Reliability, Performance, Client Delivery, Compliance & Security, Self-Serve & Admin, Fundraising / Strategy, Infra / DevOps, Research / Exploration`

**Categories (new list, col B, rows 21–27)**:
`Core Product, Client Delivery, Fundraising / Strategy, Performance, Research / Exploration, Infra / DevOps, Quality & Reliability, Compliance & Security, Self-Serve & Admin, Engineering, AI, Delivery, Strategy, Performance`

**Subsystems (col A, rows 32–49)** and duplicate list in col N — union them.

**Priority / Impact / Difficulty** — all `1, 2, 3` scale. Difficulty in the real data goes up to `4`; treat the list as a minimum.

## Appendix B: Observed data-quality issues to track

Put these in a `sheet_warnings` page (visible to admins only in V1, or just loggable for now):

- Experiments Status: 10 distinct raw values for ~5 real states
- `"Done"` with surrounding quote chars in Experiments
- Categories enum drift between col A and col B of Lists tab
- `Max` and `Maksym` possibly the same person
- `Pedram/Dan'l` uses apostrophe variant of Daniel
- Rows 2 and 3 of Planning have `Seq=0.9` and `Seq=1.0` respectively but different statuses — just a minor inconsistency, not actionable
- Several Planning rows have `seq='?'` — treat as null-ish in sort