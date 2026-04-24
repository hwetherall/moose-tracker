import { supabaseServer } from "@/lib/supabase/server";

export type ExpRow = {
  key: string;
  sheet_row: number;
  problem: string | null;
  problem_planning_id: number | null;
  experiment: string | null;
  question: string | null;
  scope: string | null;
  details: string | null;
  status: string;
  status_raw: string | null;
  notes: string | null;
};

export async function fetchExperiments(): Promise<ExpRow[]> {
  const sb = supabaseServer();
  const { data, error } = await sb.from("experiments").select("*").order("sheet_row");
  if (error) throw error;
  return (data ?? []) as ExpRow[];
}

export async function fetchExperimentsForPlanning(id: number): Promise<ExpRow[]> {
  const sb = supabaseServer();
  const { data, error } = await sb.from("experiments").select("*").eq("problem_planning_id", id);
  if (error) throw error;
  return (data ?? []) as ExpRow[];
}
