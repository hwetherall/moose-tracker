import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Captures every current planning_items row into planning_items_daily for today.
 * Idempotent per (snapshot_date, item_id): re-running on the same UTC day
 * upserts the data jsonb so we always have the latest snapshot of the day.
 */
export async function takeDailySnapshot(sb: SupabaseClient): Promise<{ rows: number; date: string }> {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await sb.from("planning_items").select("*");
  if (error) throw error;
  const items = data ?? [];

  if (items.length === 0) {
    return { rows: 0, date: today };
  }

  const rows = items.map((item) => ({
    snapshot_date: today,
    item_id: item.id as number,
    data: item
  }));

  const { error: upErr } = await sb
    .from("planning_items_daily")
    .upsert(rows, { onConflict: "snapshot_date,item_id" });
  if (upErr) throw upErr;

  return { rows: rows.length, date: today };
}
