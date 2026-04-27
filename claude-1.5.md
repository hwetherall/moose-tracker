# claude-1.5.md — Moose Dashboard V1.5

The "from spreadsheet view to actual product" release. Builds on the working V1 + polish pass.

## Read this first

This file is **additive** to `CLAUDE.md` and `claude-cleanup.md`. It does not replace them. Architecture, data model, schema, routing, auth, and the entire visual system are inherited unchanged. Where this file conflicts with earlier specs, this one wins for V1.5 features only.

V1.5 has four real features, in build order:

1. **Snapshotting infrastructure** (invisible to users but unblocks V2)
2. **Signals on the Overview** — derived metrics that turn the dashboard from a card-view into something that has an opinion
3. **Chat** — read-only Q&A over the tracker via tool calls
4. **Write** — a "+ New item" form that appends rows to the Planning sheet

Build them in that order. Snapshotting is unsexy but it's the one thing that will be impossible to retrofit later. Signals raise the apparent value of the existing data without writing any new infra. Chat + write are the demo moments for Daniel.

**Before writing code:**
1. Read this file end to end.
2. Read the current state of `CLAUDE.md`, `claude-cleanup.md`, and the running app.
3. Reply with: (a) what migrations and new packages this work requires, (b) any spec ambiguity given the codebase as-is, (c) what order you'll actually build in. Wait for confirmation before starting.

---

## 1. Snapshotting infrastructure

The cron job currently overwrites `planning_items` on every sync. That throws away history. We need history to ever do velocity, cycle time, or trend lines, so we start capturing it now even though no UI consumes it until V2.

### 1.1 New tables

```sql
-- Daily snapshot of every item, one row per (date, item_id).
-- Written by a separate cron at 23:55 UTC daily (NOT every 5min — too noisy).
create table planning_items_daily (
  snapshot_date date not null,
  item_id int not null,
  -- Mirror of all relevant fields. Use jsonb for the whole normalized item
  -- to avoid schema-drift pain when we add columns to planning_items later.
  data jsonb not null,
  primary key (snapshot_date, item_id)
);
create index on planning_items_daily (item_id, snapshot_date desc);

-- Append-only log of status transitions. Written by the 5-min poll
-- whenever it detects a row whose status differs from the cached version.
create table status_changes (
  id bigserial primary key,
  item_id int not null,
  from_status text,            -- null on first sight of an item
  to_status text not null,
  changed_at timestamptz not null,  -- approx — actually "first time we saw the new value"
  detected_by_sync_id bigint references sync_log(id)
);
create index on status_changes (item_id, changed_at);
create index on status_changes (to_status, changed_at);

-- Optional but cheap: log of items entering/leaving Blocked specifically.
-- Useful because "blocked" is a state we report on heavily.
create table blocked_episodes (
  id bigserial primary key,
  item_id int not null,
  started_at timestamptz not null,
  ended_at timestamptz,         -- null while active
  blocker_text text,            -- snapshot of the blocker field at start
  resolved_to_status text       -- the status it moved to, when ended
);
create unique index on blocked_episodes (item_id) where ended_at is null;
```

### 1.2 Cron changes

- Existing 5-min poll: also detects status transitions and writes to `status_changes`. Compare incoming `status` against cached `status` on each item. On transition, INSERT a row.
- Also handles `blocked_episodes` — opening a row when status becomes `0-Blocked` or `blocker` text appears, closing it when neither is true.
- New nightly job: `vercel.json` cron at `55 23 * * *` UTC → `/api/cron/snapshot`. Reads current `planning_items`, INSERTs one row per item into `planning_items_daily` for today's date.

### 1.3 Backfill

Don't try to backfill history we don't have. The first day of V1.5 deployment is day zero. Document this in the README so future-you doesn't try to compute "30-day throughput" before 30 days have passed.

### 1.4 What this does NOT include

No UI. No charts. No metrics derived from history. The only V1.5 surface that touches these tables is a single internal `/api/admin/snapshot-stats` endpoint that returns row counts, so you can verify the cron is working. That's it.

---

## 2. Signals on the Overview

This is the bit that fixes "it's just a spreadsheet rendered as cards." A new section on the Overview, between the stat strip and the Blocked section, called **Signals**. Each signal is a small inline finding that the dashboard surfaces *without being asked*. Computed from the current snapshot only — no history dependency.

### 2.1 The signal palette

Each of these is a separate computation. Render only the ones whose conditions are met. If none fire, hide the section entirely (do not render an empty "No signals" widget — that looks broken).

| Signal | Condition | Renders as |
|--------|-----------|------------|
| **Concentration risk** | Any one person is on >25% of active items (status ∈ in-flight set) | "Pedram is on 8 active items, 4× the team average. Consider rebalancing." with a chip linking to `/owners?filter=pedram` |
| **Priority inversion** | An item with rank ≤ 200 has a `blocker` field that resolves to an item with rank ≥ 230 OR status = Backlog | "#26 (rank 132) is blocked by #71 which is in Backlog. Promote the blocker, or accept the slip." |
| **Stale Discovery** | Item with status = `3-Discovery` for >30 days (use `status_changes` once available; until then, fall back to `synced_at` of first appearance) | "3 items have been in Discovery over 30 days. They may be stuck behind a decision." |
| **Stale blocked** | Item with `blocked_since` >14 days AND no `comments` update in last 7 days (we can't compute "comments updated" without a diff — use comments field non-null as weak signal for V1.5) | "#6 has been blocked 18 days. Last note: 'waiting for generation strategy decision.'" |
| **Definition gap** | Item with status ∈ {1-InDev, 1-InDevPrompt} AND `dod` is null | "4 in-dev items have no Definition of Done. They will be hard to land cleanly." |
| **Ownership gap** | Item with status ∈ {1-InDev, 2-ReadyForDev} AND `r_emails` is empty | "2 active items have no Responsible owner." |
| **Release risk** | Current release has any items not Done AND `revised_prod` is in the past | "R17 was due Apr 28 (today). 3 items are not yet Done." |
| **Transitive blocker** | Item links to a `PRMT-*` whose normalized linked status is also Blocked | (V1.5: we don't have Jira integration yet — defer this signal to V2) |

### 2.2 Visual treatment

Signals render as a compact 2-column grid of `<SignalCard>` components below the stat strip. Each card:

- Top row: small lucide icon (severity-coded — `AlertCircle` for warnings, `Info` for observations, `TrendingDown` for risks) + signal title in serif 14px weight 500
- Body: one-sentence finding in body sans 13px text-secondary
- Bottom: optional action chip ("View 3 items →") that links to the relevant filtered view

Border treatment: `0.5px solid border.subtle`, no fill. **Severity color appears only as a 2px left border** — `status.blocked.dot` for warnings, `status.discovery.dot` for observations, `status.inDev.dot` for routine info. This is the only place in the app where a left-only border is allowed (per `claude-cleanup.md` rules — set `border-radius: 0` on that side).

### 2.3 Signals page (`/signals`)

A "See all signals →" link in the Signals section header goes to a dedicated page that runs every check and lists every finding, grouped by severity. Same `<SignalCard>` component, no truncation. Useful for Daniel's morning sweep.

### 2.4 Implementation note

Each signal is a pure function from the current snapshot to `Signal[]`:

```ts
type Signal = {
  id: string;             // stable: 'concentration:pedram'
  severity: 'warning' | 'observation' | 'info';
  title: string;
  body: string;
  affectedItemIds: number[];
  actionLabel?: string;
  actionHref?: string;
};

type SignalCheck = (snapshot: PlanningItem[], people: Person[]) => Signal[];
```

Put each in `lib/signals/<name>.ts`, register them in `lib/signals/index.ts`, run them in a single sweep on Overview load. Cache for 60s.

This architecture also sets up V2's expert agent — the agent is just "run all signal checks, then have an LLM write a brief about them." Investing here pays double.

### 2.5 Lightweight metrics that complement Signals

In addition to Signals (which are findings), add three quiet inline metrics on the Overview, integrated into existing UI rather than as their own section:

1. **Concentration bar in the stat strip.** Replace nothing — add a 5th cell after "Due This Week" called **Top owner** showing the person with the most active items + their count. "Pedram · 8 items".
2. **Owner-load tooltip on the By Owner nav item.** Hover the sidebar "By owner" link → tooltip shows top 3 owners by active count.
3. **Release composition chip on the "This release · R17" header.** A small pill: `4 Epic · 3 Story · 1 Task`. Computed from the items in that release. Renders only on Overview release section.

These are tiny, but together with Signals they shift the read from "list of stuff" to "the dashboard noticed something."

---

## 3. Chat

A floating chat widget accessible from any page. Read-only Q&A over the tracker. The model does not see the table — it sees a tool surface.

### 3.1 Model and provider

- Provider: OpenRouter
- Model: `google/gemini-3.1-flash-lite-preview`
- Use exactly that slug. It is a recent model that may not be in your training data; the user has confirmed it exists. Do not substitute another model. Do not "verify" the model exists by searching first — just use it. If the OpenRouter call fails, surface the error to the user including the model slug; do not silently fall back.
- Streaming responses on. Tool use must be enabled.
- API key in env: `OPENROUTER_API_KEY`. Use `https://openrouter.ai/api/v1/chat/completions` directly via `fetch`; no need for the SDK.

### 3.2 Where the chat lives

Floating circular button at bottom-right of the viewport, 48px, brand-primary background, white chat-bubble lucide icon. Click → bottom-right panel slides up: 380px wide, 560px tall, `bg.surface`, `border.subtle`, `xl` radius, with a 4px brand-primary top border. Header shows "Ask about Moose" in serif 15px, close button.

The panel is non-modal — you can keep using the dashboard while it's open. Esc closes it. State persists across route changes within the session.

Do not put chat as a top-nav item. It's a tool, not a destination.

### 3.3 Tool surface

The model gets these tools, and only these:

```ts
{
  name: 'list_items',
  description: 'List planning items matching one or more filters. Returns items sorted by rank ascending (highest priority first). Filters compose with AND semantics.',
  parameters: {
    status?: string[],         // canonical status values
    category?: string[],
    subsystem?: string[],
    owner_email?: string[],    // matches r/a/d
    release?: string[],
    type?: ('Epic'|'Story'|'Task')[],
    blocked?: boolean,         // shorthand for status=0-Blocked OR blocker non-null
    ready?: boolean,           // shorthand for is_ready=true
    limit?: number,            // default 20, max 100
  }
}

{
  name: 'find_items',
  description: 'Fuzzy text search across item names. Use when the user mentions an item by partial name like "the MAAP one" or "the Sherpa epic".',
  parameters: { query: string, limit?: number }
}

{
  name: 'get_item',
  description: 'Full detail on a single item including links, experiments, parent epic, and children.',
  parameters: { id: number }
}

{
  name: 'who_owns',
  description: 'Given an optional filter, return people grouped by their item counts. Useful for "who is working on X" or "what is everyone doing".',
  parameters: {
    category?: string[],
    subsystem?: string[],
    status?: string[],
    role?: ('R'|'A'|'D')[],   // default ['R','A']
  }
}

{
  name: 'whats_for',
  description: 'All items where the given person is R, A, or D. Optionally filtered by status.',
  parameters: {
    person_email: string,
    status?: string[],
    role?: ('R'|'A'|'D')[],
  }
}

{
  name: 'whats_blocked',
  description: 'All currently-blocked items, sorted by blocked_since descending (longest stuck first).',
  parameters: {}
}

{
  name: 'release_status',
  description: 'A release with its planned/revised/actual dates and item composition by status.',
  parameters: { name: string }   // 'R17', 'R18', etc.
}

{
  name: 'get_signals',
  description: 'The current Signals shown on Overview. Use this when the user asks "what should I look at" or "what is wrong" or for a morning summary.',
  parameters: {}
}
```

Each tool returns JSON with a fixed shape. Items are returned with a stable shape — keep it small (id, name, status, type, category, subsystem, release, rank_score, owner_names[], due_date, blocker?). The detail drawer is what `get_item` returns; everything else returns the compact shape to keep tokens down.

### 3.4 System prompt

```
You are an assistant for the Moose Tracker, Innovera's company-wide planning system. You help executives understand the current state of work.

Hard rules:
- Only answer using results from the provided tools. Never speculate about items, people, or status you have not seen via a tool.
- Always cite items by their ID with a hash, like #26. The UI will turn these into clickable links automatically.
- When listing more than 3 items, format them as a compact bulleted list with ID, name, and one piece of status context per line.
- If the user asks something the tools cannot answer (e.g. "why did Pedram do X"), say so plainly and suggest what you could answer instead.
- Do not write status updates, decisions, or commitments. You read; you do not write.
- Do not invent links to Jira, Slack, Drive, etc. If a link is in the data, it is in the data; if it is not, do not make one up.

Tone: concise, observational, slightly dry. You are a senior PM who has read the whole tracker, not a chatbot. Default response length is 2-4 sentences. Bullet lists when listing items.

Current date: {today}. The user's email is {user_email}. Their canonical display name is {user_name}.
```

### 3.5 Frontend

- Use the Vercel AI SDK (`ai` package) with the OpenRouter-compatible endpoint configured. The streaming UI helpers (`useChat`) are straightforward.
- Render assistant messages with markdown support. Render `#26`-style references as clickable chips that open the item detail drawer.
- Render tool calls visibly but compactly: a one-line "🔍 Looking up blocked items…" line that collapses to "Looked up blocked items" once complete. Useful for trust; tells Daniel the model isn't making things up.
- No persistence in V1.5. Refresh = new conversation. Show an empty-state message: "Ask about owners, blockers, releases, or signals."
- Suggested prompts on empty state, as click-to-send chips:
  - "What should I look at first this morning?"
  - "What's blocked right now?"
  - "What is everyone working on for R17?"
  - "Who has the most on their plate?"

### 3.6 Backend route

`app/api/chat/route.ts`. Standard streaming chat endpoint. Pass the tool definitions, handle multi-turn tool calls until the model stops requesting tools. Cap at 5 tool-call turns per user message to prevent runaway loops.

Log every conversation to `chat_log` table for V2 quality work:

```sql
create table chat_log (
  id bigserial primary key,
  user_email text not null,
  message_index int not null,
  role text not null,             -- 'user' | 'assistant' | 'tool'
  content text,
  tool_name text,
  tool_args jsonb,
  tool_result jsonb,
  created_at timestamptz not null default now()
);
create index on chat_log (user_email, created_at);
```

This log is private to admins (Harry). Not surfaced in the UI in V1.5. It's there so we can later see what people actually ask, which is the input for tuning the tool surface.

---

## 4. Write — new item form

The narrow write feature. Lets execs add a row to the Planning sheet without opening Google Sheets. Keep this scope tight: **add only**. No edit, no delete, no bulk.

### 4.1 Entry point

A "+ New item" button in the page header, between the Refresh button and the user pill. Ghost style, lucide `Plus` icon, label "New". Click opens a centered modal (480px wide).

### 4.2 Form

Fields, in display order:

| Field | Required | Input | Notes |
|-------|----------|-------|-------|
| Name | yes | text | Min 3 chars |
| Type | yes | select | Epic / Story / Task |
| Status | yes | select | Defaults to `5-Backlog`. Only show statuses that make sense for new items: Backlog, Discovery, ReadyForDev. |
| Category | yes | select | From canonical list (cleanup.md tokens) |
| Subsystem | no | select | From canonical list |
| Priority (P) | yes | radio 1/2/3 | Defaults 2 |
| Impact (I) | yes | radio 1/2/3 | Defaults 2 |
| Difficulty (D) | yes | radio 1/2/3/4 | Defaults 2 |
| Rank Score | computed | display only | `P*100 + I*10 + D`, updates live |
| Release | no | select | R14–R18, "Unassigned" default |
| Responsible (R) | no | multi-select | From people table |
| Accountable (A) | no | multi-select | From people table |
| Definer (D) | no | multi-select | From people table |
| Due Date | no | date | |
| Definition of Done | no | textarea | 3 rows |
| Comments | no | text | One line |
| Parent / Epic | no | combobox | Searches existing items where type=Epic |

Submit button label: "Add to Moose". Cancel closes modal without saving.

### 4.3 Submit flow

This is the tricky part because of the bimodal C-suite — the sheet must remain authoritative.

1. Validate locally. Show inline errors.
2. Optimistically insert the row into the local `planning_items` cache with a synthetic negative ID (`-{timestamp}`) and `pending_sync: true`. The card appears immediately on whatever view the user is on, with a small "Adding…" badge in place of the rank.
3. POST to `/api/items/create`. Server appends a row to the Planning sheet via `spreadsheets.values.append`. Sheet assigns the real ID (next integer in the ID column).
4. Server returns the assigned ID and the sheet row number.
5. On next 5-min sync (or immediate manual sync — see below), the cache reconciles: the optimistic row with synthetic ID is replaced by the real row matched on (name, created_at within 60s).
6. **Trigger an immediate sync** after a successful create instead of waiting up to 5 minutes. Otherwise the user adds a row, sees it in their UI, but a sibling refresh from another exec doesn't see it. Add a `syncNow()` call to the create endpoint after the sheet append succeeds.

If the sheet append fails:
- Roll back the optimistic insert
- Show an inline error toast with the failure reason
- Form re-opens with the data still populated

If validation passes but the user closes the modal mid-submit, the request still completes — but if it fails, surface the error as a header toast since the modal is gone.

### 4.4 Field validation specifics

- `Name` cannot be a duplicate of any existing item name (case-insensitive match). Warn on near-duplicates (Levenshtein < 3) but don't block.
- `Parent / Epic` combobox: type to search, max 8 results, empty selection allowed.
- People multi-selects: the displayed list comes from the `people` table, sorted by display_name. Show display name; submit email under the hood.
- Sheet write uses the canonical display_name (Pedram, not pedram, not Pedram@innovera.ai). The owner resolution path on read should still work because aliases include both forms.

### 4.5 Server route

`app/api/items/create/route.ts`. POST. Body validated with Zod against the form schema. Sheet append uses A1 range `Planning!A:Y` with `valueInputOption: 'USER_ENTERED'`. Order of values must match the column order in `CLAUDE.md` §4.1.

Empty fields go in as empty strings, not nulls — the sheet displays `null` literally otherwise.

### 4.6 Permissions

V1.5: any authenticated `@innovera.com` user can add items. No role restrictions. We'll learn whether that's wrong from observed behavior, not from arguing about it now.

---

## 5. Small fixes

These are the loose ends from the V1 review and the screenshot.

1. **Confirmed: Max = Maksym.** Update the seed to keep `Max` in Maksym's aliases. (Already in `claude-cleanup.md` §Data cleanup.)

2. **Refresh button should pulse during `pending_sync` items.** When the user has just submitted a new item and the sync is in-flight, the Refresh icon spins continuously until the optimistic row reconciles. Reuses the `animate-spin` from the regular refresh action — just gated on a different condition.

3. **Item detail drawer needs a "Last updated" timestamp.** Pull from `synced_at`. Renders in text-tertiary 11px below the name. Not a fix, an addition that helps with the stale-data conversation.

4. **`#ID` references in chat output need to be clickable.** Post-process assistant messages to wrap `#\d+` patterns in a chip component that opens the detail drawer. Use a simple regex in the streaming render path; no need to involve the model.

5. **Add `data-test-id` attributes** to the new item form fields and the submit button. Useful for hand-testing now, and necessary if we ever add e2e tests.

---

## 6. Done checklist

Before marking V1.5 complete:

- [ ] `planning_items_daily`, `status_changes`, `blocked_episodes`, `chat_log` tables exist with indexes
- [ ] Nightly snapshot cron is running and writing rows
- [ ] 5-min poll detects status changes and writes to `status_changes`
- [ ] `/api/admin/snapshot-stats` returns sane row counts
- [ ] Signals section on Overview renders the right signals against current data; hides cleanly if none fire
- [ ] `/signals` page exists with severity grouping
- [ ] Top owner cell in stat strip
- [ ] Release composition chip on Overview release section header
- [ ] Owner-load tooltip on sidebar
- [ ] Chat widget opens, streams, calls tools, renders results, no console errors
- [ ] Chat clearly shows tool calls in the UI
- [ ] `#26`-style references in chat output are clickable
- [ ] New Item modal validates, submits to sheet, optimistically renders, reconciles on next sync
- [ ] Sheet append uses correct column order; rows added show up correctly on next read
- [ ] Form errors surface clearly
- [ ] Rank Score updates live as P/I/D change
- [ ] Both light and dark modes pass for every new component
- [ ] No new hardcoded colors or font sizes

---

## 7. Hand back

When done, post:
- Screenshot of Overview with at least one Signal firing, light + dark
- Screenshot of chat answering "What's blocked right now?"
- Screenshot of New Item modal mid-fill
- A two-line note on which model + provider you actually used in case a fallback was needed
- Any spec ambiguity you resolved on your own

---

## Appendix A — V2 brainstorm

Harry's note for the user: the user asked what would take this from "good" to "great." Below is my honest ranking with reasoning, not a spec. Read, react, and we'll convert the chosen ones into a V2 spec later.

### Tier 1 — these are the difference-makers

**A1. The expert agent (already in `CLAUDE.md` §V2).** Now that V1.5 has Signals, the agent is a small step beyond: same rule sweep, but the LLM writes a morning brief in Daniel's voice and emails it at 7am. Findings get 👍/👎 feedback that tunes per-user rule thresholds. This is the feature most likely to make Daniel say "this is now actually mine."

**A2. Velocity, throughput, and forecasting.** Once `status_changes` and `planning_items_daily` have 4+ weeks of data, you can compute: average time in each status, weekly throughput per owner, blocked-aging trends, and a release-completion forecast ("at the current done-rate, R18 will land May 21 ± 4 days"). This is the moment the dashboard moves from descriptive to predictive.

**A3. Jira integration.** Two-way: pull live status of every `PRMT-*` and `INV-*` reference into the detail drawer, and surface signal #8 ("Transitive blocker") which depends on it. Adds maybe 1.5 weeks of work, including Jira webhook setup. Probably second to ship after the agent.

### Tier 2 — high value, well-scoped

**A4. Edit-in-place with optimistic concurrency.** The other half of "write." Row-hash on load, refuse save on hash change, three-way diff modal showing local edit vs sheet state vs base. Soft locks via `editing_by` field with 30s TTL. ~1.5 weeks.

**A5. Slack morning brief.** The agent's brief, posted to a channel as a structured Slack message at 7am with the worst signals and a link back to the dashboard. The "Daniel doesn't have to log in" feature.

**A6. Saved views.** Right now the URL is the state. Promote that to first-class — a user can save a filter set with a name, get a shareable link, and the saved view appears in their sidebar. This is the persona pages we punted on, done correctly.

**A7. Mono integration as a chat tool.** Add a new chat tool: `research(question)` that calls Mono and returns a brief. Now the chat can answer "is the LG/Samsung tables blocker resolved?" by reading the tracker AND going to the web. This is also where the agent can do its blocker-resolution research automatically.

### Tier 3 — nice but not transformative

**A8. Comments and threads on items.** Lets people respond to signals and to each other on the dashboard rather than in Slack. Risk: becomes another silo.

**A9. Public read-only share links.** Generate a tokenized URL that lets a board member or client view a specific filtered view without auth. Useful for fundraising decks and partner reviews.

**A10. CSV/PDF/Slides export of any view.** "Export this view as a one-pager" that produces a real Innovera-branded PDF for offline reading.

**A11. Audit log per item.** Who changed what when, surfaced in the detail drawer. Becomes essential as more people edit, but premature now.

**A12. Mobile layout.** Stat strip stacks, kanban becomes horizontally scrollable, signals go to top. Probably 1 week of work for someone who likes responsive design. Lower priority than agent + velocity.

### Tier 4 — interesting but I'd talk you out of these

**A13. AI-suggested rank score.** Given an item's name and category, the model predicts P/I/D. Sounds clever, but the rank is a *political* value (it reflects what leadership cares about, not what's objectively important). Automating it removes the conversation that makes the value real.

**A14. Goals/OKRs layer.** Every item maps to a quarterly objective. Powerful in theory, but quarterly-OKR systems are organizational, not technical, and dashboards rarely change whether they work.

**A15. Smart reminders.** "@Maksym, #46 has been Ready For Dev for 9 days." Probably annoying within a week, even at low frequency. Slack already has reminders; adding more pings to people's day rarely lands well.

### My recommendation for V2

Build **A1 + A2 + A3** as a coherent release. Together they shift the value proposition from "we have a nice dashboard" to "we have a system that watches, predicts, and explains." Once that lands, A4 + A5 follow naturally.

Avoid the temptation to build A6 saved views first because it feels concrete and safe. It's worth doing, but it's a polish move, and V2 should make a bigger statement than that.
