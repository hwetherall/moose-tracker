# claude-priority.md — Priority-first dashboard

The "the sheet is a ranked list, so the dashboard should be too" pass. A focused UI change in response to feedback that the current dashboard reflects *what* exists but not *what matters most*.

## Read this first

This file is **additive** to `CLAUDE.md`, `claude-cleanup.md`, and `claude-1.5.md`. It does not replace them. Architecture, data model, schema, routing, auth, sync, and the visual system are inherited unchanged. Where this file conflicts with earlier specs, this one wins.

This is a UI/UX change. There are **no migrations, no new tables, no new sync logic**. Every piece of data we need is already on `planning_items` (`priority`, `impact`, `difficulty`, `rank_score`).

**Before writing code:**
1. Read this file end to end.
2. Re-read `claude-cleanup.md` §Item card and §Overview — this work modifies both, but must use the existing tokens and component APIs.
3. Reply with: (a) any spec ambiguity given the codebase as-is, (b) a list of every file you expect to touch, (c) build order. Wait for confirmation before starting.

---

## 1. The principle

> **Priority is the default narrative of the dashboard.** Every list shows ordinal position, every card shows tier, the Overview leads with the prioritized backlog, and within every grouping the topmost card is the highest-priority one. Status, release, and owner remain useful lenses — but they are *secondary*. The sheet is a ranked list. The dashboard is too.

The Moose Tracker rank score (`P × 100 + I × 10 + D`) is the source of truth for priority and is not changing — Spencer owns it. Our job is to *visualize* the ordering, not redefine it.

---

## 2. Scope

### 2.1 In
- Priority tier pill (`P1` / `P2` / `P3`) on every primary and compact item card
- P3 cards visually de-emphasized (opacity, no other change)
- Ordinal numbering on rank-sorted views
- New "Top Priorities" section on the Overview, second slot (after the stat strip, before Blocked)
- Stat strip "Active" cell rephrased to expose the priority tier breakdown
- Audit + enforce: every grouped view (Kanban, Release) sorts cards by rank within columns

### 2.2 Out
- No new IA. We are NOT adding a `/priority` page, NOT renaming `/items`, NOT introducing Now/Next/Later tiers.
- No changes to the rank formula, the New Item modal, the chat tools, or the signals engine. (`priorityInversion` already does the right thing.)
- No changes to Owners, Subsystems, or Experiments pages — those are not rank-sorted by nature.
- No tooltip explaining what P1/P2/P3 means. The pills are self-evident in context. We can add one in a polish pass if Daniel asks.

### 2.3 What "active" means

For every priority surface in this file, **active** means:

```ts
const ACTIVE_STATUSES = [
  '0-Blocked',          // blocked is in-flight, just stuck
  '1-InDev',
  '1-InDevPrompt',
  '2-ReadyForDev',
  '3-Discovery',
  '4-Experiment',
];
// Excluded: '5-Backlog', '0-Done', '0-?'
```

Backlog and Done are excluded from priority lists, ordinal numbering, and the stat strip's tier breakdown. They burn space without informing decisions. They remain visible everywhere else (Items page, Kanban, etc.) under their normal filters.

Add this as `lib/queries/planning.ts → ACTIVE_STATUSES` and re-use everywhere; do not duplicate the literal.

---

## 3. Priority tier pill

### 3.1 New component

`components/items/PriorityPill.tsx`

```tsx
type Props = {
  priority: 1 | 2 | 3 | null;
  rankScore: number | null;
  size?: 'default' | 'compact';
};
```

Renders:
- `priority` ∈ {1,2,3}: a small pill with `P1` / `P2` / `P3` text, plus a trailing rank score in tabular text-tertiary. Format: `[P1] 113`. The pill and score sit on one line.
- `priority` null but `rankScore` non-null: just `Rank N` in text-tertiary tabular (today's behavior — kept as graceful fallback).
- Both null: render `"no rank"` in text-tertiary italic (matches existing behavior in `claude-cleanup.md`).

Pill spec:
- 10px text, semibold, `0.04em` tracking, uppercase
- Padding `1px 6px`, radius `sm`, no border
- Background and text colors come from priority tokens (see 3.2)
- Compact size: same except 9px text, padding `0px 5px`

### 3.2 Priority tokens

Add to the design tokens (CSS custom properties in `globals.css`, mirrored in `tailwind.config.ts`):

```css
:root {
  --color-priority-p1-text: #8C4A1F;     /* warm rust — distinct from status-blocked red */
  --color-priority-p1-bg:   #F4E6D8;     /* soft warm tint, sits on bg-page without shouting */
  --color-priority-p2-text: var(--color-text-secondary);
  --color-priority-p2-bg:   var(--color-bg-muted);
  --color-priority-p3-text: var(--color-text-tertiary);
  --color-priority-p3-bg:   transparent; /* P3 pill is outline-only */
}
.dark {
  --color-priority-p1-text: #D9A073;
  --color-priority-p1-bg:   #3A2A1F;
  --color-priority-p2-text: var(--color-text-secondary);
  --color-priority-p2-bg:   var(--color-bg-muted);
  --color-priority-p3-text: var(--color-text-tertiary);
  --color-priority-p3-bg:   transparent;
}
```

P3 pill renders with a `0.5px` border in `border-subtle` instead of a fill, since its background is transparent.

These are starting values — Harry to tune to brand once it lands. The constraint: **P1 must be obvious at a glance without competing with `status.blocked.text`** (the only other warm color on the page). P2 should read as "normal." P3 should read as "deprioritized but present."

### 3.3 Card-level dimming

In `ItemCard` (primary) and `ItemCardCompact`, when `priority === 3`:

- Wrap the card body in `opacity: 0.78`
- The pill itself is *not* dimmed (it stays at full opacity so the P3 label is legible against its outline)

Implementation:

```tsx
<div
  className={cn(
    'rounded-lg border ...',
    priority === 3 && 'opacity-[0.78]'
  )}
>
  <CardBody />
  <PriorityPill priority={priority} rankScore={rankScore} />  {/* sits in a div with opacity:1 */}
</div>
```

P1 cards get **no** background or border treatment in V1 of this work. The pill alone carries the P1 signal. We chose this on the "obvious not screaming" axis — adding a P1 border accent on top of the pill would tip into shouting. Reconsider in a polish pass if Daniel says it's not loud enough.

### 3.4 Card placement

The `PriorityPill` replaces the existing `Rank N` slot in the bottom-right of the primary card. The structure stays:

```
┌────────────────────────────────────────┐
│ #97  [Epic]  Core Product · Portfolio  │
│ Project list - build (see also 56)     │
│ R: Pedram   A: Spencer        [P1] 113 │  ← was: "Rank 111"
└────────────────────────────────────────┘
```

For the compact card (used inside Overview release columns and the new Top Priorities row), the pill sits inline with the title row:

```
[P1] 113   Project list - build      ● 1-InDev
```

---

## 4. Ordinal numbering

### 4.1 Where it appears

- **Top Priorities** section on Overview (1. through 10.)
- **Items page** (`/items`) — when sorted by rank (which is the default), every row is numbered

### 4.2 Where it does NOT appear

- Kanban, Release, Blocked, Owners, Subsystems, Experiments — these are not rank-ordered linear lists; numbering would mislead.
- Items page when the user has explicitly chosen a non-rank sort (e.g. by due date) — show no numbers, since the order is no longer "the priority backlog."

### 4.3 Visual treatment

- A 28px fixed-width left gutter on each row, before the card body
- Numeral in `tabular-nums`, `text-tertiary`, 12px, top-aligned with the card's first line of text
- Format: `1.`, `2.`, ..., `10.`, `11.` — period included
- Numbering is ordinal **within the current view's filter set**. If the user filters Items to `subsystem=Portfolio`, numbering restarts at 1 inside that filter. The gutter shows the user's relative ordering of what they're looking at — not a global rank.

This is a render-time concern only — no DB or query change. The list is already rank-sorted; just render the index.

---

## 5. Top Priorities section (Overview)

### 5.1 Position

The Overview becomes:

```
1. Stat strip
2. Top Priorities          ← NEW
3. Blocked
4. My Queue (conditional, as today)
5. This Release
```

Spacing between sections stays at 36px per `claude-cleanup.md`.

### 5.2 Data

- Pull `planning_items` where `status` ∈ `ACTIVE_STATUSES`
- Sort by `rank_score` ascending, then `due_date` ascending (matches the Items page default)
- Limit 10
- Items with `rank_score IS NULL` are excluded from this section entirely (they have no priority signal to convey; they show up on Items page with `"no rank"` instead)

Add a query helper: `lib/queries/planning.ts → fetchTopPriorities(limit = 10)`.

### 5.3 Visual treatment

- Section header per `claude-cleanup.md`'s `<SectionHeader>`:
  - Title: `Top priorities`
  - Subtitle: `Active items, ranked by Spencer's priority score` (keeps the editorial voice; makes the source of the ranking explicit)
  - Right link: `See all priorities →` linking to `/items` (which is rank-sorted by default)
- Below the header: a single-column list of 10 numbered rows
- Each row uses `ItemCardCompact` with the ordinal numeral in the left gutter
- No internal grouping, no dividers — it's meant to read as one ranked list

The choice of single column (vs the 2-column grid Blocked uses) is deliberate: a single vertical stack visually reads as "ordered top to bottom," which is the whole point. Two columns would force the eye to zigzag and undermine the ordinality.

### 5.4 Row format

Each row, left to right:

```
 1.   #97  [Epic]  Project list - build              ● 1-InDev   Pedram   Apr 29   [P1] 113
```

Order of elements within the compact card body:
- `#ID` (text-tertiary, tabular)
- `<TypeBadge>`
- Item name (truncate to single line, no wrap)
- *Right-aligned cluster:* `<StatusDot>` + status name, owner avatar + first name (R only — A and D would be too dense for a one-liner), due date if present (red if overdue, amber if within 7 days), `<PriorityPill>`
- If blocked: `stuck Xd` chip in `status.blocked.text` replaces the due date

Row height: ~36px. The whole section, with header and 10 rows, should be ~440px tall — proportionate to the existing Blocked section (4 cards in a 2×2 grid).

---

## 6. Stat strip update

The strip stays four cells wide (R17 still leftmost and wider). Only the **Active items** cell changes.

### 6.1 Before

```
ACTIVE ITEMS
47
items in flight
```

### 6.2 After

```
ACTIVE ITEMS
47
12 P1 · 28 P2 · 7 P3
```

The caption is the tier breakdown. Use the priority token text colors for each segment so `12 P1` is in `priority.p1.text`, `28 P2` in `priority.p2.text`, `7 P3` in `priority.p3.text`. Separators are en-spaces and middle dots in `text-tertiary`.

If any tier is zero, drop that segment entirely (don't render `0 P1`). If `priority` is null on an item, it doesn't count toward any tier — but it still counts toward the total active number.

Edge case: if all active items have null priority, the caption falls back to today's `items in flight` string. Don't render an empty caption.

The other three cells (Blocked, Due this week, R17 health) are unchanged.

---

## 7. Sort behavior across all views

The principle: **within any grouping, cards are ordered top-to-bottom by rank score ascending.** Audit each surface:

### 7.1 Items page (`/items`)
Already sorts by rank ascending then due date ascending. Adds ordinal numbering per §4. The sort control to the right of filters now shows `Sorted by priority ↓` as the default label (instead of just "Sort"), making the order intentional.

### 7.2 Kanban (`/kanban`)
Within each status column, sort cards by `rank_score` ascending. **Verify in the existing query.** If today's query orders by ID or insertion order, change it.

### 7.3 Release (`/release`)
Within each release column, items are grouped by status (Done collapsed at bottom, per `claude-cleanup.md`). Within each status group inside the column, sort by rank ascending. **Verify in the existing query.**

### 7.4 Blocked (`/blocked`)
Stays sorted by `blocked_since` desc — time-stuck is the right primary axis for this page. Add `rank_score` ascending as the **secondary** sort, so two items stuck the same number of days resolve by priority.

### 7.5 Owners / Subsystems / Experiments
No change. These are grids of counts or non-rankable items.

---

## 8. What we are NOT doing

To forestall scope creep — these were considered and rejected:

- **No dedicated `/priority` page.** The Top Priorities section + the rank-sorted Items page cover it. Adding another route is IA bloat.
- **No "Now / Next / Later" tiering.** Spencer's rank already provides ordering; deriving cutoffs adds an opinion the dashboard shouldn't have.
- **No renaming `/items` to `/priorities`.** "Items" is the generic word and applies under any sort. The new "Sorted by priority" label communicates the default behavior without hiding the other sorts.
- **No P1 card border or background tint.** Pill alone for V1. Reconsider after Daniel sees it live.
- **No changes to the rank formula or P/I/D inputs.** Spencer owns the formula.
- **No tier filter chips on the Items page** (e.g. a `P1 only` toggle). The rank sort already surfaces P1s at the top; a filter would be a hammer where the existing sort is a scalpel. Add later if asked.
- **No re-ranking of chat tool outputs.** `list_items` already sorts by rank ascending. Untouched.

---

## 9. Open TBDs

- **P1 token values.** The hex codes in §3.2 are starting values. Harry to tune against the actual brand palette and re-test in dark mode before merge.
- **Items page count badge.** When ordinal numbers appear in the gutter, the existing "47 shown" header label may feel redundant. Consider removing it once we see the page.
- **Mobile.** This spec assumes the desktop layout. The Top Priorities row is information-dense; on mobile (<768px) we may need to drop the owner avatar and due date from each row to fit the pill. Defer to first mobile review.
- **The "see also #N" suffix in item names** (e.g. `Project list - build (see also 56)`) eats horizontal space in the dense Top Priorities row. We may want to strip those at render time *only in this section* — leave the underlying name unchanged. Confirm with Spencer.

---

## 10. Build order

1. **`PriorityPill` component + tokens** (§3.1, §3.2). Land the component standalone with stories/snapshots before wiring anything up. Smallest unit, biggest downstream propagation.
2. **Wire `PriorityPill` into `ItemCard` and `ItemCardCompact`** (§3.4). Replaces the `Rank N` slot. Adds the P3 opacity wrapper (§3.3). Every page using item cards now reflects priority. Manually verify each page in light + dark mode.
3. **Sort audit** (§7.2, §7.3, §7.4). Update queries so within-column ordering is rank ascending. This is not visible without §1, §2, but ensures the rest of the work has a consistent foundation.
4. **`fetchTopPriorities` query helper + `TopPriorities` section component** (§5). Slot into the Overview between the stat strip and Blocked. This is the headline new feature.
5. **Ordinal numbering** (§4). Apply to the Top Priorities section first (where it's load-bearing), then to the Items page when sorted by rank.
6. **Stat strip caption** (§6). Smallest visible change; lands last so the data and tokens are already proven.

After each step, the app should still build, type-check, and pass existing tests. There are no new tests required for this work beyond the snapshot for `PriorityPill` — the changes are visual and the underlying data is already exercised.

---

## Acceptance check

When this work is done, an exec opening the dashboard for the first time should be able to answer "what are the most important things in flight right now?" without scrolling, without clicking, and without reading more than the section header and the first three rows. If they can't, we haven't shipped the principle.
