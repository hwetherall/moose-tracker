# claude-cleanup.md — Moose Dashboard Polish Pass

A focused visual/UX revision to the existing M1–M3 build. Not a rewrite. Not a rescope.

## Read this first

This file describes a **surgical pass** over an already-working dashboard. Every change here serves one of three goals:

1. Establish a clear visual hierarchy (header → section → card → metadata)
2. Move from "shadcn default" to a Notion-warm, Innovera-flavored aesthetic
3. Fix a small set of correctness/data issues we noticed while reviewing

If a change in this file conflicts with the original `CLAUDE.md`, this file wins for visual matters and `CLAUDE.md` wins for architecture and data model. When in doubt, ask before deviating — don't invent a third option.

**Before you start coding**, do the following in order:

1. Read `CLAUDE.md` end to end so you understand the data model and the views that exist.
2. Read this file end to end.
3. Spend 5 minutes browsing the current app. List in your reply: which pages exist, which components they share, where typography and color decisions currently live (a `theme.ts`? Tailwind config? Per-component?). This determines how invasive the polish pass is.
4. Summarize back to the user (a) what you'll change, (b) what you'll leave alone, and (c) anything in this spec that's ambiguous given what's actually in the codebase. Wait for confirmation before writing code.

Do not skip step 4. The mock in this spec assumes a clean slate; the real codebase doesn't have one.

## The aesthetic, in one paragraph

Notion-warm, not Linear-cold. The page background is a near-white with warm undertones, not a cold gray-50. Headings are serif; body is sans. Hierarchy comes from typography scale and whitespace, not from cards-with-borders on everything. There is one accent color — Innovera moose-brown — and it appears only on brand surfaces (logo, current-user avatar, active nav state). It never encodes data. Status colors are muted, not saturated. Dark mode goes warm-charcoal, not pure black. The whole thing should feel like a considered editorial product, not an admin panel.

## Design tokens

Add a `lib/theme.ts` (or extend the existing one) with the following tokens. All UI must reference these by name. No hardcoded hex anywhere except inside this file.

### Colors

```ts
// Light mode
const light = {
  bg: {
    page:      '#FBFAF7',  // warm off-white, page background
    surface:   '#FFFFFF',  // cards, drawer, modals
    muted:     '#F4F2EC',  // sidebar, stat strip dividers, hover states
    inset:     '#EFEDE6',  // search input, code blocks, raw-data sections
  },
  text: {
    primary:   '#1F1E1B',  // headings, key numbers
    secondary: '#5C5A54',  // body, labels
    tertiary:  '#8E8B82',  // metadata, timestamps, hints
    inverse:   '#FBFAF7',  // text on dark/brand surfaces
  },
  border: {
    subtle:    'rgba(31, 30, 27, 0.08)',   // default card and section borders
    medium:    'rgba(31, 30, 27, 0.16)',   // hover, focus
    strong:    'rgba(31, 30, 27, 0.24)',   // emphasized dividers
  },
  brand: {
    primary:   '#8B5A3C',  // moose-brown, Innovera accent
    primarySoft: '#F0E4D9', // brand-tinted surface (current-user avatar bg)
  },
  status: {
    done:        { dot: '#3B6D11', soft: '#EAF3DE', text: '#27500A' },  // green
    inDev:       { dot: '#185FA5', soft: '#E6F1FB', text: '#0C447C' },  // blue
    readyForDev: { dot: '#5F5E5A', soft: '#F1EFE8', text: '#2C2C2A' },  // gray
    discovery:   { dot: '#BA7517', soft: '#FAEEDA', text: '#633806' },  // amber
    experiment:  { dot: '#534AB7', soft: '#EEEDFE', text: '#3C3489' },  // purple
    backlog:     { dot: '#888780', soft: '#F1EFE8', text: '#444441' },  // muted gray
    blocked:     { dot: '#A32D2D', soft: '#FCEBEB', text: '#791F1F' },  // red
    unknown:     { dot: '#B4B2A9', soft: '#F1EFE8', text: '#5F5E5A' },  // for 0-?
  },
  type: {
    epic:  { soft: '#EEEDFE', text: '#3C3489' },  // purple
    story: { soft: '#E6F1FB', text: '#0C447C' },  // blue
    task:  { soft: '#F1EFE8', text: '#5F5E5A' },  // gray
  },
};

// Dark mode
const dark = {
  bg: {
    page:      '#1A1916',  // warm charcoal, NOT pure black
    surface:   '#23211D',  // cards
    muted:     '#2C2A26',  // sidebar
    inset:     '#19181550', // search input
  },
  text: {
    primary:   '#F2EFE8',
    secondary: '#A8A59C',
    tertiary:  '#75726A',
    inverse:   '#1A1916',
  },
  border: {
    subtle:    'rgba(242, 239, 232, 0.08)',
    medium:    'rgba(242, 239, 232, 0.14)',
    strong:    'rgba(242, 239, 232, 0.20)',
  },
  brand: {
    primary:   '#B0795A',  // brown, lifted slightly for dark
    primarySoft: '#3D2E22',
  },
  status: {
    // Use the 200 stops from the same color families on dark mode soft fills,
    // and the 100 stops for text. Dot stays the same hue.
    done:        { dot: '#97C459', soft: '#27500A', text: '#C0DD97' },
    inDev:       { dot: '#85B7EB', soft: '#0C447C', text: '#B5D4F4' },
    readyForDev: { dot: '#B4B2A9', soft: '#444441', text: '#D3D1C7' },
    discovery:   { dot: '#EF9F27', soft: '#633806', text: '#FAC775' },
    experiment:  { dot: '#AFA9EC', soft: '#3C3489', text: '#CECBF6' },
    backlog:     { dot: '#888780', soft: '#2C2C2A', text: '#B4B2A9' },
    blocked:     { dot: '#F09595', soft: '#501313', text: '#F7C1C1' },
    unknown:     { dot: '#888780', soft: '#2C2C2A', text: '#B4B2A9' },
  },
  type: {
    epic:  { soft: '#3C3489', text: '#CECBF6' },
    story: { soft: '#0C447C', text: '#B5D4F4' },
    task:  { soft: '#444441', text: '#D3D1C7' },
  },
};
```

These are not negotiable. If a UI need calls for a color not in this set, raise it before adding one.

### Radii

```ts
{
  sm: '4px',   // pills, badges, tag chips
  md: '6px',   // inputs, buttons, small cards inside columns
  lg: '10px',  // primary cards (Blocked card, item card)
  xl: '14px',  // page-level surfaces (the stat strip)
}
```

Cards use `lg`. Inputs and small inline cards use `md`. Avoid `8px` — too generic, sits halfway between feeling sharp and feeling rounded.

### Spacing

Use a 4px base. Common values: `4 8 12 16 20 24 28 36 48`. Vertical rhythm between sections is `36px`. Padding inside cards is `14px 16px` for compact cards and `18px 22px` for primary cards. Page horizontal padding is `36px`.

### Typography

```ts
{
  serif: '"Fraunces", "Iowan Old Style", Georgia, serif',
  sans:  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono:  '"JetBrains Mono", "SF Mono", Menlo, monospace',
}
```

Load both via `next/font` so there's no FOUT. Subset Fraunces to Latin only.

**Rules:**
- Serif: page headers (`<h1>`), section headers (`<h2>`), and key display numbers (the 28px values in the stat strip). Nothing else.
- Sans: everything else, including item names and body text.
- Use `font-feature-settings: "tnum"` on every numeric value — IDs, ranks, dates, days-stuck. Tabular numerals make scanning columns of numbers possible.
- Two weights only across the entire app: 400 regular, 500 medium. No 600, no 700. Heavy weights look out of place against serif headers and Notion-warm surfaces.
- Letter spacing: `-0.015em` on serif headers ≥22px. `0.04em` and uppercase on small label text (the `OVERVIEW` / `RELEASE R17` micro-labels).

### Type scale

| Use | Family | Size | Weight | Line height |
|-----|--------|------|--------|-------------|
| Page title | serif | 26px | 500 | 1.2 |
| Section heading | serif | 17px | 500 | 1.3 |
| Display number | serif | 28px | 500 | 1 |
| Body | sans | 13.5px | 400 | 1.5 |
| Item name (in card) | sans | 13.5px | 400 | 1.4 |
| Item name (in compact card) | sans | 12.5px | 400 | 1.35 |
| Label / metadata | sans | 11px | 400 | 1.3 |
| Micro-label (uppercase) | sans | 11px | 400 | 1.3, letter-spacing 0.04em |
| Badge | sans | 10px | 500 | 1, letter-spacing 0.02em, uppercase |

Do not introduce sizes outside this scale.

## Component specs

### Owner avatar

Replace every place the codebase currently shows a lowercase first name with this component.

```
<OwnerAvatar email={...} size={18 | 22 | 28} showName={true | false} />
```

- 18px circle, single letter (first letter of canonical display name), centered, weight 500
- Background and text color are derived deterministically from a hash of the email — pull from a fixed palette of 8 status-soft / status-text pairs (use the type/status soft+text pairs from the token file). Same person always gets the same color.
- When `showName`, render the canonical display name to the right at 11px text-secondary.
- For a row of multiple owners, render avatars overlapping by 4px (negative margin), then the names comma-separated. Cap at 3 visible avatars + `+2`.
- **Capitalization is fixed at the data layer** — see the Data Cleanup section.

For unassigned roles, render text "unassigned" in `text-tertiary` italic. Do not render an empty avatar. Never render an em-dash for empty owners — write the word.

### Status dot

```
<StatusDot status={canonicalStatus} />
```

A 6px circle in the dot color from the status token. That's it. No outer ring, no glow, no animation. Used in section headers (release columns), card metadata rows, and the sidebar Blocked count.

### Type badge

```
<TypeBadge type={'Epic' | 'Story' | 'Task'} />
```

10px text, uppercase, soft background + text color from `type` tokens, padding `1px 6px`, radius `sm`. No border. If `type` is null, render nothing — do not render an "—" badge.

### Item card (primary)

Used on the Blocked grid, the Items list, the Kanban columns. Width: fills its grid cell.

Structure (top to bottom):
- Top row: `#ID` (text-tertiary, tabular) · `<TypeBadge>` · `category · subsystem` (text-tertiary, 10px) · *right-aligned:* `stuck Xd` (status.blocked.text) only if blocked > 7 days, else nothing
- Item name: 13.5px, `text-primary`, `line-height: 1.4`, max 2 lines with ellipsis
- Bottom row: avatars + names on the left, `Rank N` (text-tertiary, tabular) on the right. If no rank, render "no rank" in text-tertiary.

Padding: `14px 16px`. Border: `0.5px solid border.subtle`. Radius: `lg`. Background: `bg.surface`. Hover: border becomes `border.medium`, no background change, no shadow, no transform.

### Item card (compact)

Used inside the kanban columns on the Overview page (the "This release · R17" section). Same structure as primary, but:
- Item name at 12.5px
- Avatar at 16px
- No category/subsystem line (release columns are already grouped by status, not category)
- Padding `10px 12px`
- Radius `md`

Done items in compact form get `opacity: 0.75` and `bg.muted` background. They're context, not focus.

### Stat strip

The four-up at the top of Overview is **not** four separate cards. It's a single bordered surface (`xl` radius, `bg.surface`, `border.subtle`) with three internal vertical dividers. Each cell:
- Padding `18px 22px`
- Micro-label at top (uppercase, text-tertiary)
- Display number in serif at 28px
- One-line caption in text-secondary at 11px below

The R17 cell is wider (`1.1fr` vs `1fr`) and uses words ("On track" in serif green) instead of a number, because that's the most editorially important slot. Display number color: status.done.text if "on track", status.blocked.text if "at risk", text-primary if "no release in flight".

### Section header

```
<SectionHeader title="Blocked" linkText="See all 7" linkHref="/blocked" subtitle="..." />
```

- Title: serif 17px, weight 500
- Optional one-line subtitle below in 12px text-secondary (used on "This release · R17" to show planned date and totals)
- Right-aligned link is text-secondary 12px with " →" appended. Hover: text-primary.
- Bottom border on the section header is `0.5px solid border.subtle`, only when content below is dense (Blocked grid). Skip the border on lighter sections (release kanban) — too much line.

### Sidebar

Width 200px. Padding `20px 14px`. Background `bg.muted`. Right border `0.5px solid border.subtle`.

Top: 22px brown rounded square containing white "M", then "Moose" in serif 15px. This is the only place the brown brand color appears in the chrome.

Nav: list of links, 13px sans, padding `6px 8px`, radius `6px`. Active item: `bg.surface` background and text-primary. Inactive: text-secondary, no background; hover gets `bg.surface`.

A small "VIEWS" label in `text-tertiary` 11px uppercase sits above the list.

Each item gets a 14px lucide icon on the left. Use these icons specifically:
- Overview: `LayoutGrid`
- Items: `List`
- Kanban: `Columns3` (or similar)
- Releases: `Calendar`
- Blocked: `AlertCircle` — this one gets a count badge on the right, see below
- By owner: `Users`
- By subsystem: `Layers`
- Experiments: `FlaskConical`

Blocked nav item count badge: right-aligned, `text-tertiary` 11px, `bg.inset` background, `1px 6px` padding, `8px` radius. Updates when data refreshes.

Bottom of sidebar (mt-auto): "Last synced" block. 6px green dot if synced within last 10min, amber if 10–30, red if >30 or sync failed. Two lines: "Last synced" label in text-secondary 11px, relative time in text-tertiary 11px. Updates every 30 seconds via `setInterval`.

### Header

Page header (inside main, above content):
- Left side: micro-label "INNOVERA" uppercase, then page title in serif 26px ("Overview" / "Items" / etc.), then a one-line caption in text-secondary 13px ("Friday, April 24 · 93 items tracked"). The caption answers "what am I looking at and is it current."
- Right side: search input → Refresh button → user pill → theme toggle.
- Bottom border: `0.5px solid border.subtle`. Margin-bottom: 28px.

**Search input**: 200px wide on desktop, lucide `Search` icon inside-left at 13px text-tertiary, 13px text. Background `bg.muted`, border `0.5px subtle`, radius `md`. Focus: border becomes `brand.primary`, no glow.

**Refresh button**: ghost style, 13px sans text-secondary, lucide `RefreshCw` icon at 12px. While refreshing, icon spins (`animate-spin`), text reads "Refreshing…". Disabled state during refresh.

**User pill**: small round avatar (22px, brown background, white initial) + first name lowercase at 12px. Wrapped in a 1px subtle border, padding `4px 8px 4px 4px`, radius `20px`. Click opens menu with "Sign out".

**Theme toggle**: lucide `Sun` / `Moon` icon button, 28px square, ghost style. Persists to localStorage via `next-themes`.

### Detail drawer (item view)

Right-side drawer, 480px wide on desktop, slides in via intercepting routes (`@drawer/(.)item/[id]`). Underlying page stays visible and scrollable.

- Header: `#ID` micro-label, then item name in serif 22px below. Type badge, status dot+name, release name to the right of the title.
- Two-column metadata grid below (label-value pairs): Category, Subsystem, Priority, Impact, Difficulty, Rank Score, Due Date, Blocked Since.
- People section: R / A / D, each as `<OwnerAvatar showName>` on its own line.
- Links section: chips for each `PRMT-*` / `INV-*` / graph ref. PRMT and INV link out (use `JIRA_BASE_URL` env). Graph refs are display-only for V1.
- Experiments section: list of resolved Experiments rows, each rendered as a mini-card.
- Parent: link to parent epic if resolved.
- Children: list of items where this item is the parent epic.
- Definition of Done: rendered as a single text-secondary block.
- Comments: same.
- Raw data section, collapsed by default: shows `status_raw`, `r_raw`, `a_raw`, `d_raw` for transparency during the dirty-data period. A small "Spencer will normalize this" footnote.
- Footer: "→ Open in Sheet" button, ghost style, opens deep link to the row.

## Page-by-page polish

### Overview (`/`)

Match the layout from the mock exactly:
1. Stat strip (4 cells, R17 is leftmost and wider)
2. Blocked section: 2-column grid of Blocked items, primary cards. Show top 4. "See all 7 →" link in section header.
3. This release section: 3-column kanban (Ready for dev / In dev / Done) with compact cards and column headers showing dot + name + count. "See full release →" link in section header.

Spacing between sections: 36px.

The "My Queue" section from the original CLAUDE.md goes here too, but **only render it if the logged-in user appears in any item's r/a/d**. Otherwise hide entirely. Place it between Blocked and This Release.

### Items (`/items`)

Full list view. Filters at top (Status, Category, Subsystem, Release, Owner, Type) as multi-select chips, not dropdowns — chips show what's currently filtered. Active filter chip uses brand.primarySoft background and brand.primary text. List below uses the primary item card stacked, one per row, full width.

Sort defaults: Rank Score ascending (lowest = highest priority first), then due date ascending. Sort control to the right of filters.

### Kanban (`/kanban`)

Six columns left to right: Backlog, Discovery, Ready for Dev, In Dev, Experiment, Done. Blocked items appear as a collapsed row at the top of the page (not as a column) — header reads "7 blocked items" in status.blocked.text, click to expand into a flat list.

Cards are compact-card style. Drag is disabled (V1 read-only).

### Release (`/release`)

Columns are releases R14 through R18 plus an Unassigned column. Within each column, group by status (Done collapsed at bottom). Column header shows release name in serif, then planned/revised/actual prod dates in text-secondary 11px, then slip days if any in status.blocked.text.

### Blocked (`/blocked`)

Flat list, sorted by `blocked_since` desc. Each row is a primary item card with extra emphasis on the blocker text and days-stuck. Show blocker text as a quoted block in text-secondary italic below the item name.

### Owners (`/owners`)

Grid table. Rows are people (canonical display names from `people` table, plus Unassigned). Columns: In Dev, Ready, Discovery, Blocked, Backlog, Done (last 30d). Cells show count, click navigates to filtered Items view. Use tabular-nums everywhere.

Empty cells render as text-tertiary "—" (this is the one place an em-dash is allowed — it's a structural absence in a grid, not a missing piece of data).

### Subsystems (`/subsystems`)

Same structure as Owners but rows are subsystems.

### Experiments (`/experiments`)

Mirror of Kanban using normalized status. Cards show key, experiment name, normalized status, and a link to the parent Planning item if `problem_planning_id` resolved. Raw status visible in detail drawer only.

## Dark mode

- Use `next-themes` with `attribute="class"` and a `data-theme` switch on `<html>`.
- All token references go through CSS custom properties so the swap is automatic. Set them up in `globals.css` like:
  ```css
  :root { --color-bg-page: #FBFAF7; ... }
  .dark { --color-bg-page: #1A1916; ... }
  ```
- The toggle in the header swaps modes. Default to `system`.
- Test every component in dark mode before declaring done. Common breakages: hardcoded `#fff`, `bg-white`, `text-black`, `border-gray-200` from earlier shadcn defaults — find and replace all with token references.
- Status dot colors stay the same hue in both modes; soft backgrounds and text colors swap to the dark variants in the token file.
- The brown brand color brightens slightly in dark mode (`#8B5A3C` → `#B0795A`) so it doesn't go muddy.

## Data cleanup (small but high-visibility)

These are the issues we noticed in the screenshot. Fix them in the normalization layer (`lib/sheets/normalize.ts` or wherever owner resolution lives), not in the UI.

1. **Capitalize names properly.** Pipeline today is producing `felipe`, `pedram`, `maksym`, `jeff`. The source of truth is the `people` table — `display_name` field. Owner resolution should:
   - Split raw owner string on `/`
   - For each piece, look up canonical `display_name` from the alias map
   - Return `{ email, display_name }` pairs
   - UI renders `display_name`. Never render the raw string.

2. **Seed the people table.** Create a `seed/people.ts` file with these initial entries. Run as a one-off script.

```ts
const people = [
  { email: 'pedram@innovera.ai',  display_name: 'Pedram', aliases: ['pedram', 'Pedram'] },
  { email: 'spencer@innovera.ai', display_name: 'Spencer', aliases: ['spencer', 'Spencer'] },
  { email: 'jeff@innovera.ai',    display_name: 'Jeff', aliases: ['jeff', 'Jeff'] },
  { email: 'daniel@innovera.ai',  display_name: 'Daniel', aliases: ['daniel', 'Daniel', "Dan'l", "dan'l"] },
  { email: 'harry@innovera.ai',   display_name: 'Harry', aliases: ['harry', 'Harry'] },
  { email: 'maksym@innovera.ai',  display_name: 'Maksym', aliases: ['maksym', 'Maksym', 'Maks', 'maks', 'Max', 'max'] },
  { email: 'olga@innovera.ai',    display_name: 'Olga', aliases: ['olga', 'Olga'] },
  { email: 'vika@innovera.ai',    display_name: 'Vika', aliases: ['vika', 'Vika'] },
  { email: 'felipe@innovera.ai',  display_name: 'Felipe', aliases: ['felipe', 'Felipe'] },
  { email: 'carson@innovera.ai',  display_name: 'Carson', aliases: ['carson', 'Carson'] },
  { email: 'hanna@innovera.ai',   display_name: 'Hanna', aliases: ['hanna', 'Hanna'] },
  { email: 'anna.h@innovera.ai',  display_name: 'Anna H.', aliases: ['AnnaH', 'annah', 'Anna H'] },
  { email: 'nobu@innovera.ai',    display_name: 'Nobu', aliases: ['nobu', 'Nobu'] },
];
```

**Confirm with the user**: Are `Max` and `Maksym` actually the same person? The mapping above assumes yes. If no, split into two entries and remove the `Max` / `max` aliases from Maksym.

3. **Render "—" on every R/A/D field needs a sweep.** Many cards in the screenshot show `R: —  A: —` even where the sheet has values. Audit the owner resolution path for silent failures — likely a case mismatch or a row where the name field has trailing whitespace. Add a `console.warn` for every owner string that doesn't resolve, surface those in the sync_log.

4. **Add "Last synced Xm ago" to the sidebar footer.** Spec'd in CLAUDE.md, missing from the build. Use the `synced_at` from the most recent `sync_log` row.

5. **The "stuck Xd" indicator on Blocked items.** Compute as `today - blocked_since` (days). Render only when > 7 days. Color: status.blocked.text. Format: `stuck 18d` (no space, "d" suffix). Also surface this in the detail drawer with the exact `blocked_since` date.

## What not to change

- Routing structure (already matches CLAUDE.md spec)
- Supabase schema
- The sync job
- Auth flow
- Existing API endpoints

This pass is purely visual + the small data fixes above.

## Done checklist

Before marking this pass complete:

- [ ] All hardcoded colors replaced with token references; `grep -r "#[0-9a-fA-F]\{6\}"` returns matches only inside `lib/theme.ts`
- [ ] All hardcoded font sizes replaced with the type-scale system
- [ ] Fraunces and Inter loaded via `next/font` with no FOUT
- [ ] Dark mode toggle works and every page renders correctly in both modes
- [ ] Owner names render capitalized everywhere
- [ ] Every page uses the new `<OwnerAvatar>`, `<StatusDot>`, `<TypeBadge>`, `<SectionHeader>` components — no inline duplicates
- [ ] "Last synced" timestamp visible in sidebar footer, updates on cron
- [ ] "Stuck Xd" indicator appears on Blocked items where applicable
- [ ] Stat strip on Overview uses serif for display numbers
- [ ] Theme toggle in header
- [ ] No `border-gray-*`, `bg-white`, `text-black`, `text-gray-*` Tailwind classes left in components — all replaced with token-driven classes
- [ ] Spot-check 5 items where the sheet has owners and confirm names render correctly

## Hand back

When done, post a short summary in chat:
- Screenshot of the new Overview, light + dark
- List of any tokens/components you added beyond what's specified, with one-line justification each
- Any spec ambiguity you resolved on your own (and how)
- Any data issues encountered during owner resolution that need user follow-up
