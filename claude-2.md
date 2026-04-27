# claude-2.md — Moose Dashboard V2

The "the dashboard now thinks" release. An expert agent that lives inside the database, plus the structured enrichment that gives it something useful to think about.

## Read this first

This file is **additive** to `CLAUDE.md`, `claude-cleanup.md`, and `claude-1.5.md`. It does not replace them. The V1 architecture, V1.5 snapshotting/signals/chat/write features, and the entire visual system are inherited unchanged. Where this file conflicts with earlier specs, this one wins for V2 features only.

V2 has three real features, in build order:

1. **Task enrichment** — new structured fields (brief, acceptance criteria, risk, effort, related items) drafted by the agent, approved by humans, persisted in Supabase with one writeback column to the sheet.
2. **Inspector** — a sweep of deterministic correctness checks, surfaced as findings. The "ensure we don't make any errors" piece.
3. **Brief** — daily LLM-generated narrative summary of what's changed and what matters, delivered in-app. Email and Slack delivery move to V3, but V2 should create the reusable brief, HTML rendering, and preference/storage foundations that make those integrations straightforward later.

Build them in that order. Enrichment first because it's the substrate everything else benefits from — a brief about thin tasks is itself a thin brief. Inspector second because it's mostly deterministic, cheap to ship, and builds trust before the LLM-heavy brief lands. Brief last because it's the visible feature but it's only as good as the data it summarizes.

The agent loop, the proposal queue, and the feedback memory are shared infrastructure across all three. Build them once, use them three times.

**Out of scope for V2**, explicitly:
- Jira integration (your colleague's parallel track — coordinate, don't merge)
- Email and Slack delivery — defer to V3. Keep the future integrations in mind while building the brief log, rendered HTML, and subscription/preference foundations.
- Recommender mode (autonomous edit suggestions beyond enrichment) — defer to V2.5
- Velocity, throughput, and forecasting (Tier 1 brainstorm A2) — defer to V2.5
- Edit-in-place with optimistic concurrency (Tier 2 brainstorm A4) — defer to V2.5
- Auto-write to the sheet without human approval — explicit policy decision, see §3.5
- Persona voice (briefs in Daniel's voice, etc.) — generic crisp first; persona earns its way in later

**Before writing code:**
1. Read this file end to end.
2. Read the current state of `CLAUDE.md`, `claude-cleanup.md`, `claude-1.5.md`, and the running app on Vercel.
3. Reply with: (a) what migrations and new packages this work requires, (b) any spec ambiguity given the V1.5 codebase as-deployed, (c) what order you'll actually build in within the three pillars, (d) confirm you've read §3.5 and accept the no-auto-write policy. Wait for confirmation before starting.

---

## 1. Architecture

The agent is not a service. It's a **scheduled loop** plus a **proposal queue**, sharing the existing Next.js + Supabase stack. No new infrastructure beyond a couple of cron entries and one new directory.

```
┌──────────────────────────────────────────────────────────────┐
│  Vercel Cron                                                 │
│   ├─ */15 * * * *  → /api/cron/agent/inspect                │
│   ├─ 0 */2 * * *   → /api/cron/agent/enrich                 │
│   └─ 5 7 * * *     → /api/cron/agent/brief   (07:05 UTC)    │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
              lib/agent/* (TS modules)
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   inspector/    enrich/       brief/
   (deterministic) (LLM-draft)  (LLM-narrative)
        │            │            │
        └────────────┴────────────┘
                     │
                     ▼
              Supabase tables
              (findings, proposals, brief_log, feedback)
                     │
                     ▼
          In-app UI
          (/inbox page,
           signal cards,
           brief card)
```

**Principles**:
- **Suggestions only.** The agent never writes to the Sheet without an explicit human approval. The only thing it writes autonomously is to its own Supabase tables (findings, proposals, brief log). See §3.5 for the full policy.
- **Cron, not webhooks.** Same reasoning as V1: simpler, more debuggable, fits Vercel's primitives. Three crons, three different cadences.
- **Stateless workers.** Each cron run reads current state from Supabase, computes findings/proposals/brief, writes back. No long-running processes.
- **Deterministic before probabilistic.** Anything that can be a pure function (every Inspector check, most enrichment field defaults, all metric computations) is. The LLM is only invoked for prose generation, ranking, and field drafting where heuristics don't suffice.
- **Hybrid storage for enrichment.** Structured fields live in Supabase. One human-approved field — the brief — is written back to a single new sheet column called `AI Brief`. Spencer adds one column, not eight.

---

## 2. Task enrichment

This is the biggest feature in V2 by lines of code and by user value. Today a row is a label and a status. After V2, a row carries enough context that someone unfamiliar with the project can understand what it is without asking.

### 2.1 The new fields

All fields are optional. Empty rendering is acceptable — the agent fills them over time, humans can edit them, neither is required for the rest of the dashboard to work.

| Field | Type | Source | Renders in |
|-------|------|--------|------------|
| `brief` | text (≤ 600 chars) | Agent draft → human approve | Detail drawer (top, below name); also written to sheet column `AI Brief` once approved |
| `acceptance_criteria` | jsonb (array of `{text, done}`) | Agent draft → human approve, then human-edited | Detail drawer, replaces the freetext `dod` field's role for new items |
| `effort_estimate` | text enum: `XS`, `S`, `M`, `L`, `XL` | Agent suggest → human accept | Detail drawer, sidebar pill on cards |
| `risk_level` | text enum: `low`, `medium`, `high` | Agent suggest → human accept | Detail drawer, color border on card if `high` |
| `risk_rationale` | text (≤ 200 chars) | Agent | Detail drawer (under risk_level) |
| `related_item_ids` | int[] | Agent detect → human confirm | Detail drawer ("Related" section, max 5) |
| `history_summary` | text (computed, not LLM) | Pure function over `status_changes` | Detail drawer ("History" section) |

`history_summary` is deterministic and does not require approval — it's just a render of `status_changes` for that item. The other six fields go through the proposal queue (§4).

`acceptance_criteria` does NOT replace `dod`. Both coexist. `dod` is the freetext field from the sheet (legacy, freeform); `acceptance_criteria` is the new structured field. The detail drawer shows AC if present, falls back to `dod` if not. New items created via the V1.5 form continue to write `dod`. The agent can propose an AC list derived from `dod` — that's one of its enrichment proposals.

### 2.2 Storage

```sql
create table item_enrichment (
  item_id int primary key references planning_items(id) on delete cascade,
  brief text,
  brief_approved_by text,                  -- email of approver
  brief_approved_at timestamptz,
  brief_synced_to_sheet boolean default false,
  acceptance_criteria jsonb default '[]'::jsonb,
  acceptance_criteria_approved_at timestamptz,
  effort_estimate text,                    -- check constraint on enum
  effort_approved_at timestamptz,
  risk_level text,                         -- check constraint on enum
  risk_rationale text,
  risk_approved_at timestamptz,
  related_item_ids int[] default '{}',
  related_approved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint effort_enum check (effort_estimate is null or effort_estimate in ('XS','S','M','L','XL')),
  constraint risk_enum check (risk_level is null or risk_level in ('low','medium','high'))
);
create index on item_enrichment (brief_synced_to_sheet) where brief_synced_to_sheet = false;
```

Note `history_summary` is not stored — it's computed at read time from `status_changes`. Cheap, always fresh.

### 2.3 The enrichment cron

`/api/cron/agent/enrich`, runs every 2 hours.

Flow:
1. Query items with no `item_enrichment` row, OR rows where the underlying `planning_items.row_hash` has changed since `item_enrichment.updated_at`. These are candidates.
2. Cap at 20 items per run. Enrichment is bounded; we don't need to redo everyone every time.
3. For each candidate, build a context bundle: name, type, category, subsystem, status, comments, dod, blocker, parent_epic name, status history, similar items (rank-nearest 3 in same category).
4. Call the model once per item with the enrichment prompt (§2.4). Get back a JSON object with all six proposable fields (brief, AC, effort, risk, risk_rationale, related_item_ids).
5. For each non-empty field returned, write a row to `agent_proposals` with `proposal_type = 'enrichment'` and the proposed value.
6. **Do not write to `item_enrichment` directly.** That table is the post-approval store. Pending values live in `agent_proposals`.

If the enrichment model returns null/empty for a field (e.g., it can't confidently estimate effort), don't propose anything for that field. Better to leave a gap than to spam the queue.

### 2.4 Enrichment system prompt

```
You are the enrichment agent for the Moose Tracker, a cross-functional planning system at Innovera.

Given a single planning item with whatever fields are populated, produce a JSON object with proposed values for these enrichment fields. Return null for any field where you do not have enough information to be confident.

{
  "brief": string | null,                // 2-3 sentences. What is this, why does it matter, what does done look like? Plain English. No marketing.
  "acceptance_criteria": Array<{text: string}> | null,  // 3-5 testable criteria. If a freetext "dod" was provided, structure it. Otherwise infer from the brief.
  "effort_estimate": "XS"|"S"|"M"|"L"|"XL" | null,  // XS=hours, S=1-2d, M=3-5d, L=1-2w, XL=>2w
  "risk_level": "low"|"medium"|"high" | null,
  "risk_rationale": string | null,       // One sentence. Only if risk_level is set.
  "related_item_ids": number[] | null    // From the "similar items" provided in context. Only include if there is a meaningful relationship (shared dependency, sequencing, overlap), not just same category.
}

Hard rules:
- Only use information present in the provided context. Do not invent technical details, owners, or dates.
- The brief should not restate the item's title. Add information.
- Return strict JSON, no commentary, no markdown fence.
- If the item is too sparse to enrich meaningfully (e.g. just a name, no category, no comments), return all nulls. That is a valid response.
```

### 2.5 Sheet writeback for `brief`

When a human approves a brief proposal, the approval handler writes the brief value into the sheet column `AI Brief` for that row, via `spreadsheets.values.update`. This is the only field that round-trips back to the sheet.

Why brief-only: it's the single most useful field for a sheet-only viewer (someone opening the Google Sheet directly), and limiting the writeback to one column keeps Spencer's schema sane. The other enriched fields stay in Supabase.

The `AI Brief` column is column 25 in the Planning sheet (after `Is Ready?`). Spencer adds it once before V2 ships. The cron sync (V1) reads it and stores it in `planning_items.ai_brief_from_sheet` — a new column on `planning_items`. The detail drawer reconciles: if `item_enrichment.brief_approved_at` is set, show `item_enrichment.brief`; else if `ai_brief_from_sheet` is set (someone wrote it directly in the sheet), show that; else show nothing.

If a human edits the `AI Brief` cell directly in the sheet, on next 5-min sync we detect divergence between `item_enrichment.brief` and `ai_brief_from_sheet`. In V2, sheet wins (consistent with the V1 principle). Surface a small "edited in sheet" badge on the detail drawer for awareness. Do not auto-overwrite the sheet.

### 2.6 Detail drawer changes

The drawer gets a new top section called "AI-enriched", clearly labeled as such, rendered before the existing raw fields. Each enriched field shows:
- The current approved value, or
- A pending proposal with inline `Approve` / `Edit & approve` / `Reject` buttons, or
- An empty state with a `Suggest one` button that triggers an on-demand enrichment for that item only.

Visual treatment: enriched fields sit in `bg.muted` with `border.subtle`. A small `Sparkles` lucide icon (12px) sits before the section header, in `text.tertiary`. No other colors. The agent's presence should feel like a thoughtful annotation, not a takeover.

---

## 3. Inspector

A sweep of correctness and consistency checks. Different from V1.5 Signals in two ways: Inspector findings are about *the data being wrong* (or internally inconsistent), where Signals are about *the work being at risk*. The two coexist.

### 3.1 The inspector palette

| Check | Condition | Severity |
|-------|-----------|----------|
| **Status / parent mismatch** | Item is `0-Done` but `parent_epic_id` resolves to an item not in `0-Done` | warning |
| **Orphan epic** | Type is `Epic` but no other items reference it via `parent_epic_id` | observation |
| **Unknown status value** | `status_raw` does not normalize to a known canonical status | warning |
| **Unknown owner** | `r_raw` / `a_raw` / `d_raw` contains a name that doesn't resolve via the people/aliases table | warning |
| **Malformed Jira link** | `links` array contains an item matching `^PRMT-` or `^INV-` whose key has whitespace, lowercase, or trailing punctuation | observation |
| **Rank score arithmetic** | `rank_score` ≠ `priority * 100 + impact * 10 + difficulty` (when all three are set) | warning |
| **Blocked without blocker** | `status` is `0-Blocked` but `blocker` is null/empty | warning |
| **Blocker without blocked** | `blocker` text is non-empty but `status` is not `0-Blocked` | observation |
| **Blocked since without blocked** | `blocked_since` is set but `status` is not `0-Blocked` and `blocker` is empty | observation |
| **InDev without DoD** | `status` ∈ {1-InDev, 1-InDevPrompt} AND both `dod` is null/empty AND `acceptance_criteria` is empty | observation (already a Signal, but rendered differently here — see §3.4) |
| **Future blocked-since** | `blocked_since` is in the future | warning |
| **Done with future due_date** | `status = 0-Done` AND `due_date` > today | observation |
| **Status churn** | Item has 4+ status transitions in the last 7 days (per `status_changes`) | observation |

These are all pure functions. Each lives in `lib/agent/inspector/<name>.ts` with this signature:

```ts
type InspectorCheck = (ctx: AgentContext) => InspectorFinding[];

type InspectorFinding = {
  check_id: string;             // stable: 'orphan-epic'
  severity: 'warning' | 'observation';
  item_id: number;              // every finding is about a specific item
  title: string;                // 'Orphan Epic'
  detail: string;               // one sentence
  suggested_fix?: {             // optional — if there's a clean fix
    field: string;
    current_value: any;
    proposed_value: any;
    rationale: string;
  };
};
```

`AgentContext` is the same object the brief and enrichment use — see §5.1.

### 3.2 The inspect cron

`/api/cron/agent/inspect`, every 15 minutes.

Flow:
1. Build `AgentContext` once.
2. Run every Inspector check.
3. Diff results against `agent_findings` rows for the same `(check_id, item_id)` pairs:
   - New finding → INSERT.
   - Existing finding still firing → UPDATE `last_seen_at`.
   - Existing finding no longer firing → mark `resolved_at = now()`.
4. For findings with `suggested_fix`, also write to `agent_proposals` with `proposal_type = 'inspector_fix'` (deduped by `check_id + item_id`).

No LLM call in the inspector path. It's pure logic. The only LLM interaction Inspector findings get is when the brief composes them into prose (§4), and at that point they're already in `agent_findings`.

### 3.3 Inspector storage

```sql
create table agent_findings (
  id bigserial primary key,
  check_id text not null,
  item_id int not null references planning_items(id) on delete cascade,
  severity text not null,
  title text not null,
  detail text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (check_id, item_id, resolved_at)  -- allow re-firing after resolution
);
create index on agent_findings (item_id) where resolved_at is null;
create index on agent_findings (last_seen_at desc);
```

### 3.4 Inspector vs V1.5 Signals — why both

V1.5 Signals are aggregate, Inspector is per-item. A V1.5 Signal says "4 in-dev items have no Definition of Done"; an Inspector finding says "#34 has no Definition of Done." They convey the same information at different granularities. Render strategy:

- Overview page: Signals as before, unchanged.
- Detail drawer: Inspector findings for *this specific item* shown as a small list under the AI-enriched section, with the same severity treatment (2px left border in severity color, no other fill).
- `/inbox` page (new, §4): Inspector findings + enrichment proposals interleaved, grouped by item.

Do not double-render the same insight. If a V1.5 Signal aggregates over the items, suppress the per-item Inspector findings on the Overview page only — they remain visible in the drawer and inbox.

### 3.5 The no-auto-write policy

The agent never writes to the Google Sheet without a human approving the specific change. This applies to:
- Enrichment proposals (any of the six fields)
- Inspector `suggested_fix` proposals
- Anything else any future feature might want to change autonomously

The agent freely writes to its own Supabase tables (`agent_findings`, `agent_proposals`, `agent_brief_log`, `agent_feedback`) and to the brief writeback path *after* approval. That's it.

This is a hard policy, not a default. Do not add a "trust mode" or an "auto-approve high confidence" toggle in V2. The trust cost of one bad auto-edit on a CRO-facing tool is enormous; the value of saving a click is small. We can revisit this once the proposal queue has thousands of human decisions to learn from. Not before.

---

## 4. The brief

A daily narrative summary generated at 07:05 UTC and delivered in-app on the Overview. Email and Slack delivery are V3 features, not V2 scope. V2 should still shape the brief as a durable, channel-ready artifact: store markdown, render/cache HTML, preserve enough snapshots for replay, and keep preference/subscription primitives ready for future delivery work.

### 4.1 The brief cron

`/api/cron/agent/brief`, runs at `5 7 * * *` UTC. Why 07:05 and not 07:00: avoids cron-schedule contention with the inspect job which runs on the hour.

Flow:
1. Build `AgentContext` (current items, signals, recent status changes, recent brief_log to avoid repetition).
2. Pull "what changed" — items whose status changed in the last 24h, items newly blocked, items newly done.
3. Pull "what's outstanding" — open Inspector findings (`resolved_at is null`), V1.5 Signals.
4. Pull "what's pending" — count of unapproved enrichment proposals.
5. Compose prompt, call model with `agent_brief.system_prompt` (§4.2).
6. Parse output (markdown), render/cache HTML, and persist both to `agent_brief_log`.
7. Do not send email, post to Slack, call delivery providers, or require delivery env vars in V2. V3 will consume the persisted brief artifact and subscription/preferences foundation.

### 4.2 Brief system prompt

```
You write the daily brief for the Moose Tracker, Innovera's cross-functional planning system. The brief is generated at 7am every day for senior leadership (Pedram, Spencer, Jeff, Daniel, Harry) and rendered in the dashboard.

You will be given:
- A list of items whose status changed in the last 24 hours.
- A list of currently open warnings (the inspector findings).
- The current Signals (concentration, priority inversion, stale items, etc.)
- A count of pending enrichment proposals awaiting approval.

Produce a markdown brief with this exact structure:

## What changed (last 24h)
A 2-4 line paragraph summarizing the meaningful status moves. Group by theme (e.g. "Two items moved into InDev, both in the Generation subsystem"). Skip changes that don't matter (Backlog reshuffles, owner-typo fixes). Cite items with #ID.

## What needs attention
A bulleted list of at most 5 items, ranked by severity. Each bullet is one line. Use #ID. If there is nothing meaningful, write "Nothing critical."

## Open questions
At most 2 bullets. Things a human needs to decide that the data alone cannot. Skip the section entirely if there are none.

Hard rules:
- Default response length: 150-300 words. Shorter is better than longer.
- Cite items with #ID. The UI turns them into links.
- Tone: senior PM voice. Observational, dry, no exclamation points, no emoji except possibly a single ⚠️ before a critical bullet.
- Do not invent. If the input has no meaningful changes, say so plainly.
- Do not include "good morning" or sign-offs. UI and future delivery wrappers handle that.
- Never name an owner negatively without a specific factual basis (e.g. "Pedram has 8 items" is fine; "Pedram is overcommitted" is interpretation we are not certified to make).

Today is {today}. The current release is {current_release}.
```

### 4.3 Brief storage

```sql
create table agent_brief_log (
  id bigserial primary key,
  brief_date date not null unique,
  body_md text not null,
  body_html text not null,           -- rendered once, cached
  model_used text not null,
  input_token_count int,
  output_token_count int,
  signals_snapshot jsonb,            -- the Signals[] at time of generation
  findings_snapshot jsonb,           -- inspector findings open at time of generation
  delivery_metadata jsonb default '{}'::jsonb, -- reserved for V3 Email/Slack delivery state
  generated_at timestamptz not null default now()
);
```

We persist the inputs (`signals_snapshot`, `findings_snapshot`) alongside the output. This is what makes prompt eval possible later — replay any historical brief against a new prompt and compare.

### 4.4 In-app delivery

A new "This morning" card sits at the top of the Overview, above the stat strip, only visible if `agent_brief_log.brief_date = today`. Renders the brief markdown. If no brief exists for today (cron failed, weekend, etc.), the card hides — do not render an empty state.

The card has a small "View history" link in the top-right that opens `/brief/[date]`. Do not show a "Subscribe to email" or "Send to Slack" action in V2; those controls belong with the V3 delivery work.

### 4.5 V3 Email and Slack foundation

Email and Slack delivery are deferred to V3. Keep their needs in mind while building V2 so we do not have to unwind the brief implementation later:

- `body_md` remains the canonical model output.
- `body_html` is rendered once and cached now because Email will need it later.
- The prompt should stay channel-neutral: no greetings, sign-offs, @-mentions, or UI-only language.
- `delivery_metadata` stays empty in V2 but gives V3 a place for provider message IDs, delivery attempts, and per-channel timestamps.
- `agent_subscriptions` (§6.3) can exist as a dormant preference foundation, but V2 must not send email, post Slack messages, create Slack webhooks, or require provider credentials.

---

## 5. The proposal queue and `/inbox`

The shared surface where humans approve agent output. Whether the proposal originated in enrichment, an inspector fix, or anywhere else, it lives in `agent_proposals` and is rendered in `/inbox`.

### 5.1 Schema

```sql
create table agent_proposals (
  id bigserial primary key,
  proposal_type text not null,         -- 'enrichment' | 'inspector_fix'
  item_id int not null references planning_items(id) on delete cascade,
  field text not null,                 -- which field on the item or item_enrichment row
  current_value jsonb,                 -- what's there now
  proposed_value jsonb not null,       -- what the agent suggests
  rationale text,                      -- one-sentence explanation
  source text not null,                -- 'enrichment' | 'inspector:orphan-epic' | etc.
  generated_at timestamptz not null default now(),
  generated_by_model text,             -- null for deterministic inspector proposals
  status text not null default 'pending', -- 'pending'|'approved'|'rejected'|'edited_and_approved'|'superseded'
  resolved_at timestamptz,
  resolved_by text,                    -- email
  resolved_value jsonb,                -- what was actually written (may differ from proposed_value if edited)
  unique (item_id, field, status) deferrable initially deferred  -- only one pending per item/field
);
create index on agent_proposals (status, generated_at desc);
create index on agent_proposals (item_id, field);

create type AgentContext as never; -- (TS only — type defined in lib/agent/types.ts)
```

`AgentContext` (TypeScript type, not a DB type — the comment above is just to flag that it's referenced):

```ts
type AgentContext = {
  items: PlanningItem[];
  enrichments: Map<number, ItemEnrichment>;
  signals: Signal[];                   // from V1.5
  statusChanges: StatusChange[];       // recent N days
  blockedEpisodes: BlockedEpisode[];   // open ones
  people: Person[];
  releases: Release[];
  today: Date;
};
```

Built once per cron run via `lib/agent/context.ts`.

### 5.2 The `/inbox` page

A new page accessible from the sidebar (between Overview and Signals). The badge shows the count of pending proposals; if zero, no badge.

Layout: vertically stacked cards, grouped by item. Each item-group shows the item name + ID at the top, then one card per pending proposal underneath. Each card:

- Field label and proposal type (`Brief — enrichment`, `Status — inspector fix`)
- `current_value` rendered as struck-through or `text.tertiary` (if non-null)
- `proposed_value` rendered prominently
- `rationale` in `text.secondary` italic
- Action buttons: `Approve`, `Edit & approve`, `Reject`. `Edit & approve` opens an inline editor pre-filled with `proposed_value`.

Bulk actions at the top: `Approve all enrichment for this item`, `Reject all from this check`. Useful when the user trusts a particular check.

Empty state when no pending proposals: a calm illustration-free message — "No proposals to review. The agent will surface new ones as it finds them." Tertiary text, centered, no decoration.

### 5.3 The approval API

`app/api/proposals/[id]/route.ts`. Methods:

- `POST /api/proposals/[id]/approve` — body: `{ value?: any }`. If `value` provided, it's an "edit & approve" — that value is written; otherwise `proposed_value` is. Server applies the write to the appropriate target table (item_enrichment for enrichment, planning_items for inspector_fix), updates the proposal row to `approved` or `edited_and_approved`, records `resolved_by`, `resolved_at`, `resolved_value`.
- `POST /api/proposals/[id]/reject` — body: `{ reason?: string }`. Marks the proposal `rejected`. The reason is logged to `agent_feedback` (§6.1).

For enrichment-type approvals, if the field is `brief`, also enqueue a sheet writeback (§2.5).

For inspector_fix-type approvals, write directly to `planning_items` *and* to the Sheet (since `planning_items` is downstream of the Sheet — we have to write the Sheet to make it stick). This is the only path where the agent writes to the Sheet, and it requires explicit human approval per §3.5.

Errors during writeback: roll back the Supabase write, leave the proposal `pending`, surface the error to the user with the specific failure reason.

---

## 6. Memory and feedback

The agent should get less annoying over time. That requires a feedback loop and a per-user preferences store.

### 6.1 Feedback storage

```sql
create table agent_feedback (
  id bigserial primary key,
  user_email text not null,
  target_type text not null,          -- 'finding' | 'proposal' | 'brief'
  target_id text not null,            -- finding.id, proposal.id, or brief_log.id (as text)
  reaction text not null,             -- 'thumbs_up' | 'thumbs_down' | 'rejected'
  reason text,                        -- optional freetext
  created_at timestamptz not null default now()
);
create index on agent_feedback (user_email, target_type, created_at desc);
```

### 6.2 Per-user preferences

```sql
create table agent_preferences (
  user_email text primary key,
  suppressed_check_ids text[] default '{}',     -- inspector checks this user has muted
  suppressed_signal_ids text[] default '{}',    -- V1.5 signals this user has muted
  updated_at timestamptz not null default now()
);
```

Suppression UI: every Signal card and Inspector finding card has a small `…` menu with `Mute this check for me`. Click writes to `suppressed_check_ids`. Muted findings still appear in `/inbox` but with reduced visual weight, and they don't appear in the brief.

### 6.3 Subscriptions

```sql
create table agent_subscriptions (
  user_email text primary key,
  brief_email_subscribed boolean default false, -- V3 foundation; not wired to delivery in V2
  brief_slack_subscribed boolean default false, -- V3 foundation; not wired to delivery in V2
  slack_user_id text,                           -- V3 foundation for DMs/@-mentions
  created_at timestamptz not null default now()
);
```

For V2: this is a dormant foundation only. It is acceptable to create the table and server helpers, but do not send email, post to Slack, configure webhooks, or expose UI that implies delivery works. V3 can wire these preferences into Email and Slack delivery.

### 6.4 What feedback actually does in V2

Honestly, not much. Feedback is *captured* in V2 but only loosely *acted on*:
- Suppression is the one feedback signal that takes immediate effect (the user pressed mute).
- Thumbs-down on a brief logs the reaction; we look at it manually for now.
- Rejection of a proposal counts as implicit thumbs-down for that proposal type on that item.

V2.5 will introduce per-user threshold tuning based on accumulated feedback. V2 just builds the storage and the interaction. Don't over-engineer the feedback ML side now — there's no data yet.

---

## 7. Tables, migrations, and indexes summary

All new in V2:

```
item_enrichment
agent_findings
agent_proposals
agent_brief_log
agent_feedback
agent_preferences
agent_subscriptions
```

Plus one column added to `planning_items`:

```sql
alter table planning_items add column ai_brief_from_sheet text;
```

Plus one column added to the Google Sheet:

```
Column 25 (Y): "AI Brief"
```

Spencer must add the sheet column manually before the cron sync starts reading it. Do not have the agent create columns in the sheet.

---

## 8. Routes summary

New API routes:

```
/api/cron/agent/inspect     GET   (cron) — every 15 min
/api/cron/agent/enrich      GET   (cron) — every 2 hours
/api/cron/agent/brief       GET   (cron) — daily 07:05 UTC
/api/proposals/[id]/approve POST  (auth) — approve a pending proposal
/api/proposals/[id]/reject  POST  (auth) — reject a pending proposal
/api/agent/feedback         POST  (auth) — record a 👍/👎 on any agent output
/api/agent/preferences      GET, PUT (auth) — get/update suppression and subscription state
/api/agent/enrich-now       POST  (auth) — on-demand enrichment for a single item (rate-limited 1/min/user)
```

New pages:

```
/inbox               — pending proposals, grouped by item
/brief/[date]        — historical brief view (read-only render of any agent_brief_log row)
```

All cron routes require the `CRON_SECRET` header check that V1.5 already established. All authenticated routes inherit the existing `@innovera.com` SSO gate.

---

## 9. Model and provider

The agent uses a different model than the chat. The chat (V1.5) stays on `google/gemini-3.1-flash-lite-preview` — it's a good fit for fast Q&A. The agent benefits from stronger reasoning and runs on a bounded schedule, so cost is not the constraint.

- Provider: OpenRouter (already configured)
- Brief and enrichment model: `anthropic/claude-sonnet-4.6`
- Use exactly that slug. It is a recent model that may not be in your training data; the user has confirmed it exists. Do not substitute another model. Do not "verify" the model exists by searching first — just use it. If the OpenRouter call fails, surface the error to the cron log including the model slug; do not silently fall back to the chat's Gemini model.
- API key: existing `OPENROUTER_API_KEY`.
- Use `https://openrouter.ai/api/v1/chat/completions` directly via `fetch`, same as the chat path.
- Streaming off for cron usage — we wait for the full response and persist it. Streaming is for UIs.
- For `enrich-now` (on-demand from the detail drawer), use the same model. Streaming optional — the UI shows a small spinner; either works.

Token budgets per call:
- Brief: input ~3000 tokens, output ~500 tokens
- Enrichment: input ~1500 tokens, output ~400 tokens
- Inspector explanation (if we ever add one): N/A, no LLM calls in inspector

At current schedule and 90 items, daily LLM cost is bounded under a few dollars. Don't optimize beyond logging usage to `agent_brief_log` for the brief and an `enrichment_log` table if you want to track per-call cost.

---

## 10. Eval harness

The brief is a daily output going to senior leadership. Before changing the brief prompt, you need a way to test the change without shipping it.

Build `lib/agent/brief/eval.ts` with:

```ts
async function evalBrief(opts: {
  brief_date: string;          // pick a historical day from agent_brief_log
  prompt_override?: string;    // alternative system prompt to test
  model_override?: string;
}): Promise<{
  original: string;             // what was actually generated that day
  candidate: string;            // what the new prompt produces against the same input
  diff: string;                 // simple line diff for human review
}>
```

This works because we persist `signals_snapshot` and `findings_snapshot` on every brief log row (§4.3). Replay is exact.

A small CLI: `pnpm eval:brief <date>` prints the diff. No automated scoring in V2 — humans look at the diffs. If we accumulate enough preference data later, we can graduate to LLM-as-judge.

No eval needed for inspector (deterministic) or enrichment (per-item, low stakes individually — the queue is the safety net).

---

## 11. Failure modes

A few specific scenarios to handle explicitly. The agent failing should never break the rest of the dashboard.

**Brief cron fails (model error, timeout, etc.).** Catch, log to `agent_brief_log` with `body_md = ''` and an `error` column (add it). Overview hides the brief card. There is no Email/Slack delivery in V2. Next day's cron runs normally.

**Enrichment returns malformed JSON.** Validate with Zod. On parse failure, log and skip the item. Do not insert garbage into `agent_proposals`.

**Inspector check throws.** Caught per-check (matching the V1.5 signal pattern). One bad check does not abort the sweep. Log to console, continue.

**Sheet writeback fails (rate limit, permissions).** The proposal stays `pending`. The Supabase write is rolled back. The user sees the error inline. They can retry.

**`AI Brief` column not yet added by Spencer.** The cron sync logs a warning; the field reads as null; everything else works. Do not error on a missing optional column.

**User mutes every check.** Fine. The Inspector still runs (silently for that user). The brief still arrives but renders an empty "What needs attention" section.

**Conflict: human edits the AI Brief cell at the same time as an approval is being written.** Last-write-wins, with the sheet winning by V1 principle. The approval's `resolved_value` may not match the sheet's actual value 30 seconds later. Log this divergence to `agent_brief_log.note` for awareness; do not try to merge.

---

## 12. UI / visual additions

All of these inherit from `claude-cleanup.md`. No new colors. No new fonts. No new fundamental components. The agent is annotation, not chrome.

Components to add:
- `<ProposalCard>` — used in `/inbox` and detail drawer
- `<EnrichedField>` — generic "labeled value with optional pending state" used by all six enrichment fields in the drawer
- `<BriefCard>` — Overview card rendering today's brief markdown
- `<InspectorBadge>` — small chip used in the drawer for findings, severity-colored 2px left border same as Signal cards

Shared icon set (from lucide):
- `Sparkles` — agent-authored content marker
- `CircleCheck` / `CircleX` — approve / reject in inbox
- `Pencil` — edit & approve
- `BellOff` — mute this check
- `History` — opens brief history at `/brief/[date]`

---

## 13. Done checklist

Before marking V2 complete:

**Schema and infra**
- [ ] All seven new tables exist with indexes and constraints
- [ ] `planning_items.ai_brief_from_sheet` column added; cron sync reads it
- [ ] Spencer has added column 25 ("AI Brief") to the Planning sheet
- [ ] Three new cron entries in `vercel.json`, all triggering correctly
- [ ] `OPENROUTER_API_KEY` confirmed available; agent uses `anthropic/claude-sonnet-4.6`
- [ ] No Email/Slack provider env vars are required for V2

**Enrichment**
- [ ] Enrichment cron runs end-to-end: candidates → context → model → JSON → proposals
- [ ] Detail drawer shows "AI-enriched" section with all six fields
- [ ] Approve / edit-and-approve / reject flow works for each field
- [ ] `brief` writeback to sheet column 25 works on approval
- [ ] Sheet-side edit of `AI Brief` is detected and respected on next sync
- [ ] On-demand `enrich-now` button in drawer works, rate-limited

**Inspector**
- [ ] All 13 inspector checks implemented as pure functions
- [ ] Inspect cron runs every 15 min and updates `agent_findings`
- [ ] Per-item findings render in detail drawer
- [ ] Findings with `suggested_fix` create proposals; approval writes to Sheet
- [ ] Resolved findings get `resolved_at` set; do not re-fire spuriously

**Brief**
- [ ] Brief cron runs at 07:05 UTC daily
- [ ] Brief renders on Overview "This morning" card
- [ ] Brief stores canonical markdown and cached HTML for future Email delivery
- [ ] `delivery_metadata` remains empty unless V3 delivery code is added later
- [ ] `agent_brief_log` persists inputs and outputs for replay
- [ ] `/brief/[date]` page renders any historical brief

**Inbox**
- [ ] `/inbox` page renders, grouped by item
- [ ] Sidebar badge shows pending count
- [ ] Bulk actions (approve all for item, reject all from check) work
- [ ] Empty state renders cleanly when no proposals

**Memory**
- [ ] Mute-check action writes to `agent_preferences`
- [ ] Muted checks suppressed in Overview, drawer, brief — but still visible in `/inbox` with reduced weight
- [ ] `agent_subscriptions` exists as a V3 delivery foundation, with no V2 delivery promises in UI
- [ ] 👍/👎 on briefs and findings writes to `agent_feedback`

**Polish**
- [ ] Both light and dark modes pass for every new component
- [ ] No new hardcoded colors or font sizes
- [ ] All new routes have proper auth gates
- [ ] All cron routes have `CRON_SECRET` check
- [ ] `lib/agent/brief/eval.ts` exists and the `pnpm eval:brief <date>` CLI works

---

## 14. Hand back

When done, post:
- Screenshot of Overview with today's brief card rendered, light + dark
- Screenshot of `/inbox` with at least 3 pending proposals across at least 2 items
- Screenshot of detail drawer showing the AI-enriched section with at least one approved field and one pending proposal
- Screenshot of an Inspector finding rendered in the drawer
- Output of `pnpm eval:brief <some recent date>` showing the diff harness working
- A short note on observed model latency for brief and enrichment
- A two-line note confirming: no auto-write, no fallback model, no Jira-dependent code
- Any spec ambiguity you resolved on your own

---

## 15. Open TBDs

Decide during implementation; don't block on them:

- Whether the `enrich-now` button should be visible to all users or only to "owners" (R/A) of an item — default to all users in V2; tighten later if it's abused
- Whether the brief should render differently on weekends — for now, generate every day; if it's noisy, gate to Mon–Fri later
- Exact UTC offset for the brief — 07:05 UTC = 03:05 ET = 09:05 CET. Confirm with Daniel that he wants it before he opens his laptop, not while he's in standup
- Whether `effort_estimate` and `risk_level` need to be filterable on the items list — probably yes eventually, but not in V2

---

## Appendix A — V2.5 candidates

Things explicitly deferred. Captured here so they don't get lost.

**B1. Recommender mode.** Beyond enrichment, the agent proposes substantive changes — owner reassignments, rank adjustments, blocker promotions, item splits. Same proposal queue, different prompts. Higher trust bar; should ship after 2+ weeks of approved enrichment data so we can demonstrate the queue works.

**B2. Velocity, throughput, forecasting** (Tier 1 brainstorm A2). Once `status_changes` and `planning_items_daily` have ~6 weeks of real data, we can compute weekly throughput, average time-in-status, blocked-aging trends, release forecasts. The brief incorporates these once they exist.

**B3. Per-user threshold tuning.** Use accumulated `agent_feedback` to tune which findings get raised for whom. Requires real volume of feedback, which V2 generates.

**B4. Persona voice.** Brief written in Daniel's voice (or whoever subscribes). Sample-text-driven. Hold until at least 3 weeks of generic briefs have shipped and the format is stable.

**B5. Auto-approve threshold.** Some specific proposals (e.g., `acceptance_criteria` derived directly from `dod` text) might have high enough confidence to auto-approve once we have data. Strict opt-in, per-check, per-user.

**B6. Edit-in-place** (Tier 2 brainstorm A4). Independent of agent, but the proposal queue's approval pattern is a good rehearsal for the conflict-resolution UX.

**B7. Mono integration as agent tool** (Tier 2 brainstorm A7). The enrichment agent gains a `research(question)` tool that calls Mono. Particularly useful for blocker resolution: "is the LG/Samsung issue actually unblocked according to the latest Mono note?"

---

## Appendix B — V3 candidates

Things intentionally pushed beyond V2, but worth preparing for now.

**C1. Email and Slack brief delivery.** V3 wires the persisted daily brief into outbound channels: branded HTML email to subscribers and Slack delivery to a configured channel or user-level destination. V2 should make this easy by keeping `body_md` channel-neutral, caching `body_html`, preserving replay snapshots, and creating `agent_subscriptions` as a dormant preference foundation. Do not ship partial delivery in V2; the useful work now is making the eventual V3 integration small and clean.
