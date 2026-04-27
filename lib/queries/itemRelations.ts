import { supabaseServer } from "@/lib/supabase/server";
import { compareByPriority, type Row } from "./planning";
import type { ExpRow } from "./experiments";

export async function fetchItemBundle(id: number): Promise<{
  row: Row | null;
  parent: Row | null;
  children: Row[];
  experiments: ExpRow[];
}> {
  const sb = supabaseServer();
  const { data: rowData } = await sb.from("planning_items").select("*").eq("id", id).maybeSingle();
  const row = (rowData as Row | null) ?? null;
  if (!row) return { row: null, parent: null, children: [], experiments: [] };

  const [parentRes, childrenRes, expRes] = await Promise.all([
    row.parent_epic_id
      ? sb.from("planning_items").select("*").eq("id", row.parent_epic_id).maybeSingle()
      : Promise.resolve({ data: null as Row | null }),
    sb.from("planning_items").select("*").eq("parent_epic_id", id),
    sb.from("experiments").select("*").eq("problem_planning_id", id)
  ]);

  const children = ((childrenRes.data as Row[] | null) ?? []).slice().sort(compareByPriority);

  return {
    row,
    parent: (parentRes.data as Row | null) ?? null,
    children,
    experiments: (expRes.data as ExpRow[] | null) ?? []
  };
}
