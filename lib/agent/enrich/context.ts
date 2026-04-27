import type { Row } from "@/lib/queries/planning";
import type { AgentContext, StatusChange } from "../types";

/**
 * Build the per-item context bundle the enrichment prompt sees. Compact on
 * purpose — every field added pays for itself in tokens. The "similar items"
 * list is what `related_item_ids` is allowed to draw from; we cap at 3.
 */
export type EnrichmentItemContext = {
  id: number;
  name: string;
  type: string | null;
  category: string | null;
  subsystem: string | null;
  status: string;
  priority: number | null;
  impact: number | null;
  difficulty: number | null;
  rank_score: number | null;
  due_date: string | null;
  blocker: string | null;
  blocked_since: string | null;
  comments: string | null;
  dod: string | null;
  parent_epic_name: string | null;
  status_history: { from: string | null; to: string; at: string }[];
  similar_items: { id: number; name: string; status: string }[];
};

const SIMILAR_LIMIT = 3;
const STATUS_HISTORY_LIMIT = 6;

export function buildEnrichmentItemContext(
  row: Row,
  ctx: AgentContext
): EnrichmentItemContext {
  const parent =
    row.parent_epic_id != null
      ? ctx.items.find((i) => i.id === row.parent_epic_id)
      : null;

  const similar = pickSimilarItems(row, ctx.items);
  const history = pickRecentStatusHistory(row.id, ctx.statusChanges);

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    category: row.category,
    subsystem: row.subsystem,
    status: row.status,
    priority: row.priority,
    impact: row.impact,
    difficulty: row.difficulty,
    rank_score: row.rank_score,
    due_date: row.due_date,
    blocker: row.blocker,
    blocked_since: row.blocked_since,
    comments: row.comments,
    dod: row.dod,
    parent_epic_name: parent?.name ?? row.parent_epic ?? null,
    status_history: history,
    similar_items: similar
  };
}

function pickSimilarItems(target: Row, all: Row[]): { id: number; name: string; status: string }[] {
  if (!target.category) return [];
  const sameCategory = all.filter(
    (i) => i.id !== target.id && i.category === target.category
  );
  // Rank-nearest 3 (per spec §2.3). Items without rank go to the back.
  const targetRank = target.rank_score ?? Number.MAX_SAFE_INTEGER;
  const distance = (r: Row) =>
    Math.abs((r.rank_score ?? Number.MAX_SAFE_INTEGER) - targetRank);
  return sameCategory
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, SIMILAR_LIMIT)
    .map((i) => ({ id: i.id, name: i.name, status: i.status }));
}

function pickRecentStatusHistory(
  itemId: number,
  changes: StatusChange[]
): { from: string | null; to: string; at: string }[] {
  return changes
    .filter((c) => c.item_id === itemId)
    .slice(0, STATUS_HISTORY_LIMIT)
    .map((c) => ({ from: c.from_status, to: c.to_status, at: c.changed_at }));
}
