import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanningItem } from "@/lib/types";

export type PriorRow = {
  id: number;
  status: string;
  blocker: string | null;
};

export type PriorMap = Map<number, PriorRow>;

export async function loadPriorState(sb: SupabaseClient): Promise<PriorMap> {
  const { data, error } = await sb.from("planning_items").select("id, status, blocker");
  if (error) throw error;
  const map: PriorMap = new Map();
  for (const r of data ?? []) {
    map.set(r.id as number, {
      id: r.id as number,
      status: (r.status as string) ?? "",
      blocker: (r.blocker as string | null) ?? null
    });
  }
  return map;
}

function isBlocked(status: string, blocker: string | null): boolean {
  return status === "0-Blocked" || (blocker != null && blocker.trim() !== "");
}

/**
 * Compares prior cache state to freshly-pulled items and writes:
 *   - status_changes rows for newly-seen items and for transitions
 *   - blocked_episodes opens for items entering Blocked, closes for items leaving
 *
 * `changed_at` is approximate — it's "first time we saw the new value", which is now().
 */
export async function recordTransitions(
  sb: SupabaseClient,
  prior: PriorMap,
  current: PlanningItem[],
  syncLogId: number
): Promise<void> {
  const now = new Date().toISOString();
  const changes: Array<{
    item_id: number;
    from_status: string | null;
    to_status: string;
    changed_at: string;
    detected_by_sync_id: number;
  }> = [];

  for (const item of current) {
    const before = prior.get(item.id);
    if (!before) {
      changes.push({
        item_id: item.id,
        from_status: null,
        to_status: item.status,
        changed_at: now,
        detected_by_sync_id: syncLogId
      });
    } else if (before.status !== item.status) {
      changes.push({
        item_id: item.id,
        from_status: before.status,
        to_status: item.status,
        changed_at: now,
        detected_by_sync_id: syncLogId
      });
    }
  }

  if (changes.length > 0) {
    const { error } = await sb.from("status_changes").insert(changes);
    if (error) throw error;
  }

  // Blocked episode bookkeeping.
  // Open episodes: select once, decide per-item.
  const { data: openRows, error: openErr } = await sb
    .from("blocked_episodes")
    .select("id, item_id, blocker_text")
    .is("ended_at", null);
  if (openErr) throw openErr;
  const openByItem = new Map<number, { id: number; blocker_text: string | null }>();
  for (const row of openRows ?? []) {
    openByItem.set(row.item_id as number, {
      id: row.id as number,
      blocker_text: (row.blocker_text as string | null) ?? null
    });
  }

  const opens: Array<{
    item_id: number;
    started_at: string;
    blocker_text: string | null;
  }> = [];
  const closes: Array<{ id: number; ended_at: string; resolved_to_status: string }> = [];

  for (const item of current) {
    const open = openByItem.get(item.id);
    const blockedNow = isBlocked(item.status, item.blocker);
    if (blockedNow && !open) {
      opens.push({ item_id: item.id, started_at: now, blocker_text: item.blocker });
    } else if (!blockedNow && open) {
      closes.push({ id: open.id, ended_at: now, resolved_to_status: item.status });
    }
  }

  // Items that disappeared from the sheet but had an open episode: close them too.
  const currentIds = new Set(current.map((c) => c.id));
  for (const [itemId, open] of openByItem) {
    if (!currentIds.has(itemId)) {
      closes.push({ id: open.id, ended_at: now, resolved_to_status: "deleted" });
    }
  }

  if (opens.length > 0) {
    const { error } = await sb.from("blocked_episodes").insert(opens);
    if (error) throw error;
  }
  for (const c of closes) {
    const { error } = await sb
      .from("blocked_episodes")
      .update({ ended_at: c.ended_at, resolved_to_status: c.resolved_to_status })
      .eq("id", c.id);
    if (error) throw error;
  }
}
