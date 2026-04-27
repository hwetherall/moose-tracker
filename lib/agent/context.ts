import { supabaseService } from "@/lib/supabase/server";
import { fetchPlanningItems } from "@/lib/queries/planning";
import { fetchReleases, fetchPeople } from "@/lib/queries/releases";
import { getSignals } from "@/lib/signals";
import type {
  AgentContext,
  BlockedEpisode,
  ItemEnrichmentRow,
  StatusChange
} from "./types";

/**
 * Single-shot context builder used by every agent cron and the eval harness.
 * Reads everything in parallel; downstream passes are pure functions of this.
 */
export async function buildAgentContext(): Promise<AgentContext> {
  const sb = supabaseService();

  const [items, releases, people, signals, enrichmentsRows, statusChanges, blockedEpisodes] =
    await Promise.all([
      fetchPlanningItems({}),
      fetchReleases(),
      fetchPeople(),
      getSignals(),
      sb.from("item_enrichment").select("*"),
      sb
        .from("status_changes")
        .select("id, item_id, from_status, to_status, changed_at")
        .order("changed_at", { ascending: false })
        .limit(2000),
      sb.from("blocked_episodes").select("*")
    ]);

  if (enrichmentsRows.error) throw enrichmentsRows.error;
  if (statusChanges.error) throw statusChanges.error;
  if (blockedEpisodes.error) throw blockedEpisodes.error;

  const enrichments = new Map<number, ItemEnrichmentRow>();
  for (const e of (enrichmentsRows.data ?? []) as ItemEnrichmentRow[]) {
    enrichments.set(e.item_id, e);
  }

  return {
    items,
    enrichments,
    signals,
    statusChanges: (statusChanges.data ?? []) as StatusChange[],
    blockedEpisodes: (blockedEpisodes.data ?? []) as BlockedEpisode[],
    people,
    releases,
    today: new Date()
  };
}
