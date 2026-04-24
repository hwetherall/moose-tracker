import { supabaseServer } from "@/lib/supabase/server";
import type { Filters } from "./filters";

export type Row = {
  id: number;
  sheet_row: number;
  name: string;
  release: string | null;
  seq: string | null;
  status: string;
  status_raw: string;
  type: string | null;
  category: string | null;
  subsystem: string | null;
  parent_epic: string | null;
  parent_epic_id: number | null;
  links: { id: string; type: string; raw: string }[];
  rank_score: number | null;
  priority: number | null;
  impact: number | null;
  difficulty: number | null;
  experiments_refs: { raw: string; key: string | null }[];
  r_emails: string[];
  a_emails: string[];
  d_emails: string[];
  r_raw: string | null;
  a_raw: string | null;
  d_raw: string | null;
  due_date: string | null;
  comments: string | null;
  dod: string | null;
  blocker: string | null;
  blocked_since: string | null;
  is_ready: boolean | null;
};

export async function fetchPlanningItems(filters: Filters): Promise<Row[]> {
  const sb = supabaseServer();
  let q = sb
    .from("planning_items")
    .select("*")
    .order("rank_score", { ascending: true, nullsFirst: false });
  if (filters.status?.length) q = q.in("status", filters.status);
  if (filters.category?.length) q = q.in("category", filters.category);
  if (filters.subsystem?.length) q = q.in("subsystem", filters.subsystem);
  if (filters.release?.length) q = q.in("release", filters.release);
  if (filters.type?.length) q = q.in("type", filters.type);
  if (filters.ready === true) q = q.eq("is_ready", true);
  if (filters.ready === false) q = q.or("is_ready.is.null,is_ready.eq.false");
  if (filters.q) q = q.ilike("name", `%${filters.q}%`);

  const { data, error } = await q.limit(2000);
  if (error) throw error;
  let rows = (data ?? []) as Row[];
  if (filters.owner?.length) {
    const set = new Set(filters.owner);
    rows = rows.filter(
      (r) =>
        r.r_emails.some((e) => set.has(e)) ||
        r.a_emails.some((e) => set.has(e)) ||
        r.d_emails.some((e) => set.has(e))
    );
  }
  return rows;
}

export async function fetchPlanningById(id: number): Promise<Row | null> {
  const sb = supabaseServer();
  const { data, error } = await sb.from("planning_items").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Row | null) ?? null;
}

export async function fetchFilterOptions(): Promise<{
  categories: string[];
  subsystems: string[];
  releases: string[];
  types: string[];
  statuses: string[];
}> {
  const sb = supabaseServer();
  const { data } = await sb.from("planning_items").select("category, subsystem, release, type, status");
  const rows = data ?? [];
  const uniq = (key: keyof (typeof rows)[number]) =>
    Array.from(new Set(rows.map((r: Record<string, unknown>) => r[key as string]).filter(Boolean) as string[])).sort();
  return {
    categories: uniq("category"),
    subsystems: uniq("subsystem"),
    releases: uniq("release"),
    types: uniq("type"),
    statuses: uniq("status")
  };
}
