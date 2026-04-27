import { fetchPlanningItems, fetchPlanningById, type Row } from "@/lib/queries/planning";
import { fetchReleases, fetchPeople } from "@/lib/queries/releases";
import { fetchExperimentsForPlanning } from "@/lib/queries/experiments";
import { displayNameForEmail } from "@/lib/people";
import { getSignals } from "@/lib/signals";

type Compact = {
  id: number;
  name: string;
  status: string;
  type: string | null;
  category: string | null;
  subsystem: string | null;
  release: string | null;
  rank_score: number | null;
  owners: string[];
  due_date: string | null;
  blocker: string | null;
};

function compact(row: Row): Compact {
  const ownerEmails = new Set([...row.r_emails, ...row.a_emails, ...row.d_emails]);
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    type: row.type,
    category: row.category,
    subsystem: row.subsystem,
    release: row.release,
    rank_score: row.rank_score,
    owners: Array.from(ownerEmails).map(displayNameForEmail),
    due_date: row.due_date,
    blocker: row.blocker
  };
}

function emailMatches(emails: string[], wanted: string[]): boolean {
  const set = new Set(wanted.map((e) => e.toLowerCase()));
  return emails.some((e) => set.has(e.toLowerCase()));
}

async function listItems(args: {
  status?: string[];
  category?: string[];
  subsystem?: string[];
  owner_email?: string[];
  release?: string[];
  type?: string[];
  blocked?: boolean;
  ready?: boolean;
  limit?: number;
}) {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
  const filtered = (
    await fetchPlanningItems({
      status: args.status,
      category: args.category,
      subsystem: args.subsystem,
      release: args.release,
      type: args.type,
      ready: args.ready
    })
  )
    .filter((row) => {
      if (args.blocked === true) {
        return row.status === "0-Blocked" || (row.blocker?.trim().length ?? 0) > 0;
      }
      return true;
    })
    .filter((row) =>
      args.owner_email && args.owner_email.length > 0
        ? emailMatches([...row.r_emails, ...row.a_emails, ...row.d_emails], args.owner_email)
        : true
    )
    .slice(0, limit)
    .map(compact);
  return { items: filtered, count: filtered.length };
}

async function findItems(args: { query: string; limit?: number }) {
  if (!args.query) return { items: [], count: 0 };
  const limit = Math.min(Math.max(args.limit ?? 8, 1), 25);
  const all = await fetchPlanningItems({});
  const q = args.query.toLowerCase();
  const matched = all
    .filter((row) => row.name.toLowerCase().includes(q))
    .slice(0, limit)
    .map(compact);
  return { items: matched, count: matched.length };
}

async function getItem(args: { id: number }) {
  const row = await fetchPlanningById(args.id);
  if (!row) return { found: false };
  const exps = await fetchExperimentsForPlanning(row.id);
  return {
    found: true,
    item: {
      ...compact(row),
      r: row.r_emails.map(displayNameForEmail),
      a: row.a_emails.map(displayNameForEmail),
      d: row.d_emails.map(displayNameForEmail),
      links: row.links,
      experiments: exps.map((e) => ({ key: e.key, status: e.status, experiment: e.experiment })),
      parent_epic_id: row.parent_epic_id,
      dod: row.dod,
      comments: row.comments,
      blocked_since: row.blocked_since
    }
  };
}

async function whoOwns(args: {
  category?: string[];
  subsystem?: string[];
  status?: string[];
  role?: ("R" | "A" | "D")[];
}) {
  const items = await fetchPlanningItems({
    category: args.category,
    subsystem: args.subsystem,
    status: args.status
  });
  const roles = new Set(args.role ?? ["R", "A"]);
  const counts = new Map<string, number>();
  for (const item of items) {
    const emails: string[] = [];
    if (roles.has("R")) emails.push(...item.r_emails);
    if (roles.has("A")) emails.push(...item.a_emails);
    if (roles.has("D")) emails.push(...item.d_emails);
    for (const e of new Set(emails)) {
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
  }
  const owners = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([email, count]) => ({
      email,
      display_name: displayNameForEmail(email),
      count
    }));
  return { owners, total: items.length };
}

async function whatsFor(args: { person_email: string; status?: string[]; role?: ("R" | "A" | "D")[] }) {
  const items = await fetchPlanningItems({ status: args.status });
  const roles = new Set(args.role ?? ["R", "A", "D"]);
  const wantedEmail = args.person_email.toLowerCase();
  const matched = items
    .filter((item) => {
      const inR = roles.has("R") && item.r_emails.some((e) => e.toLowerCase() === wantedEmail);
      const inA = roles.has("A") && item.a_emails.some((e) => e.toLowerCase() === wantedEmail);
      const inD = roles.has("D") && item.d_emails.some((e) => e.toLowerCase() === wantedEmail);
      return inR || inA || inD;
    })
    .map(compact);
  return { person: displayNameForEmail(args.person_email), items: matched, count: matched.length };
}

async function whatsBlocked() {
  const items = await fetchPlanningItems({});
  const blocked = items
    .filter((row) => row.status === "0-Blocked" || (row.blocker?.trim().length ?? 0) > 0)
    .sort((a, b) => {
      const da = a.blocked_since ? new Date(a.blocked_since).getTime() : 0;
      const db = b.blocked_since ? new Date(b.blocked_since).getTime() : 0;
      return da - db;
    })
    .map((row) => ({
      ...compact(row),
      blocked_since: row.blocked_since
    }));
  return { items: blocked, count: blocked.length };
}

async function releaseStatus(args: { name: string }) {
  const [items, releases] = await Promise.all([fetchPlanningItems({ release: [args.name] }), fetchReleases()]);
  const meta = releases.find((r) => r.name === args.name);
  if (items.length === 0 && !meta) return { found: false };
  const byStatus = new Map<string, number>();
  for (const item of items) byStatus.set(item.status, (byStatus.get(item.status) ?? 0) + 1);
  return {
    found: true,
    name: args.name,
    planned_prod: meta?.planned_prod ?? null,
    revised_prod: meta?.revised_prod ?? null,
    actual_prod: meta?.actual_prod ?? null,
    planned_staging: meta?.planned_staging ?? null,
    actual_staging: meta?.actual_staging ?? null,
    composition: Object.fromEntries(byStatus),
    total: items.length
  };
}

async function listSignals() {
  const signals = await getSignals();
  return {
    signals: signals.map((s) => ({
      severity: s.severity,
      title: s.title,
      body: s.body,
      affected_item_ids: s.affectedItemIds
    })),
    count: signals.length
  };
}

async function listPeople() {
  const people = await fetchPeople();
  return { people };
}

export const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "list_items",
      description:
        "List planning items matching one or more filters. Returns items sorted by rank ascending (highest priority first). Filters compose with AND semantics.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "array", items: { type: "string" } },
          category: { type: "array", items: { type: "string" } },
          subsystem: { type: "array", items: { type: "string" } },
          owner_email: { type: "array", items: { type: "string" } },
          release: { type: "array", items: { type: "string" } },
          type: { type: "array", items: { type: "string", enum: ["Epic", "Story", "Task"] } },
          blocked: { type: "boolean" },
          ready: { type: "boolean" },
          limit: { type: "integer" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "find_items",
      description:
        'Fuzzy text search across item names. Use when the user mentions an item by partial name like "the MAAP one" or "the Sherpa epic".',
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "integer" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_item",
      description: "Full detail on a single item including links, experiments, parent epic, and children.",
      parameters: {
        type: "object",
        properties: { id: { type: "integer" } },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "who_owns",
      description:
        'Given an optional filter, return people grouped by their item counts. Useful for "who is working on X" or "what is everyone doing".',
      parameters: {
        type: "object",
        properties: {
          category: { type: "array", items: { type: "string" } },
          subsystem: { type: "array", items: { type: "string" } },
          status: { type: "array", items: { type: "string" } },
          role: { type: "array", items: { type: "string", enum: ["R", "A", "D"] } }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "whats_for",
      description: "All items where the given person is R, A, or D. Optionally filtered by status.",
      parameters: {
        type: "object",
        properties: {
          person_email: { type: "string" },
          status: { type: "array", items: { type: "string" } },
          role: { type: "array", items: { type: "string", enum: ["R", "A", "D"] } }
        },
        required: ["person_email"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "whats_blocked",
      description: "All currently-blocked items, sorted by blocked_since descending (longest stuck first).",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "release_status",
      description: "A release with its planned/revised/actual dates and item composition by status.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_signals",
      description:
        'The current Signals shown on Overview. Use this when the user asks "what should I look at" or "what is wrong" or for a morning summary.',
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "list_people",
      description: "List all known people in the company directory with their canonical display names and emails.",
      parameters: { type: "object", properties: {} }
    }
  }
] as const;

type ToolName =
  | "list_items"
  | "find_items"
  | "get_item"
  | "who_owns"
  | "whats_for"
  | "whats_blocked"
  | "release_status"
  | "get_signals"
  | "list_people";

const HANDLERS: Record<ToolName, (args: Record<string, unknown>) => Promise<unknown>> = {
  list_items: (a) => listItems(a as Parameters<typeof listItems>[0]),
  find_items: (a) => findItems(a as Parameters<typeof findItems>[0]),
  get_item: (a) => getItem(a as Parameters<typeof getItem>[0]),
  who_owns: (a) => whoOwns(a as Parameters<typeof whoOwns>[0]),
  whats_for: (a) => whatsFor(a as Parameters<typeof whatsFor>[0]),
  whats_blocked: () => whatsBlocked(),
  release_status: (a) => releaseStatus(a as Parameters<typeof releaseStatus>[0]),
  get_signals: () => listSignals(),
  list_people: () => listPeople()
};

export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const handler = HANDLERS[name as ToolName];
  if (!handler) {
    return { error: `Unknown tool: ${name}` };
  }
  try {
    return await handler(args);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
