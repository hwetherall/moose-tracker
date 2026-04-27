import { supabaseServer } from "@/lib/supabase/server";
import type { FindingRow, ItemEnrichmentRow, ProposalRow } from "@/lib/agent/types";

export async function fetchEnrichment(itemId: number): Promise<ItemEnrichmentRow | null> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("item_enrichment")
    .select("*")
    .eq("item_id", itemId)
    .maybeSingle();
  if (error) throw error;
  return (data as ItemEnrichmentRow | null) ?? null;
}

export async function fetchPendingProposalsForItem(itemId: number): Promise<ProposalRow[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("agent_proposals")
    .select("*")
    .eq("item_id", itemId)
    .eq("status", "pending")
    .order("generated_at", { ascending: false });
  if (error) throw error;
  return (data as ProposalRow[] | null) ?? [];
}

export async function fetchAllPendingProposals(): Promise<ProposalRow[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("agent_proposals")
    .select("*")
    .eq("status", "pending")
    .order("generated_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as ProposalRow[] | null) ?? [];
}

export async function fetchPendingProposalCount(): Promise<number> {
  const sb = supabaseServer();
  const { count, error } = await sb
    .from("agent_proposals")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function fetchOpenFindingsForItem(itemId: number): Promise<FindingRow[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("agent_findings")
    .select("*")
    .eq("item_id", itemId)
    .is("resolved_at", null)
    .order("severity", { ascending: true });
  if (error) throw error;
  return (data as FindingRow[] | null) ?? [];
}

export async function fetchAllOpenFindings(): Promise<FindingRow[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("agent_findings")
    .select("*")
    .is("resolved_at", null)
    .order("severity", { ascending: true })
    .order("last_seen_at", { ascending: false });
  if (error) throw error;
  return (data as FindingRow[] | null) ?? [];
}

export type BriefLogRow = {
  id: number;
  brief_date: string;
  body_md: string;
  body_html: string;
  model_used: string;
  input_token_count: number | null;
  output_token_count: number | null;
  signals_snapshot: unknown;
  findings_snapshot: unknown;
  delivery_metadata: unknown;
  error: string | null;
  note: string | null;
  generated_at: string;
};

export async function fetchTodaysBrief(): Promise<BriefLogRow | null> {
  const sb = supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb
    .from("agent_brief_log")
    .select("*")
    .eq("brief_date", today)
    .maybeSingle();
  if (error) throw error;
  return (data as BriefLogRow | null) ?? null;
}

export async function fetchBriefByDate(date: string): Promise<BriefLogRow | null> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("agent_brief_log")
    .select("*")
    .eq("brief_date", date)
    .maybeSingle();
  if (error) throw error;
  return (data as BriefLogRow | null) ?? null;
}

export async function fetchRecentBriefs(limit = 30): Promise<BriefLogRow[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("agent_brief_log")
    .select("*")
    .order("brief_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as BriefLogRow[] | null) ?? [];
}

export async function fetchUserPreferences(
  userEmail: string
): Promise<{ suppressed_check_ids: string[]; suppressed_signal_ids: string[] }> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("agent_preferences")
    .select("suppressed_check_ids, suppressed_signal_ids")
    .eq("user_email", userEmail)
    .maybeSingle();
  if (error) throw error;
  return (
    (data as { suppressed_check_ids: string[]; suppressed_signal_ids: string[] } | null) ?? {
      suppressed_check_ids: [],
      suppressed_signal_ids: []
    }
  );
}
