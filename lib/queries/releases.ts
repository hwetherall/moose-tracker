import { supabaseServer } from "@/lib/supabase/server";

export type ReleaseRow = {
  name: string;
  planned_staging: string | null;
  revised_staging: string | null;
  actual_staging: string | null;
  planned_prod: string | null;
  revised_prod: string | null;
  actual_prod: string | null;
};

export async function fetchReleases(): Promise<ReleaseRow[]> {
  const sb = supabaseServer();
  const { data, error } = await sb.from("releases").select("*");
  if (error) throw error;
  return (data ?? []) as ReleaseRow[];
}

export async function fetchPeople(): Promise<{ email: string; display_name: string }[]> {
  const sb = supabaseServer();
  const { data, error } = await sb.from("people").select("email, display_name").order("display_name");
  if (error) throw error;
  return data ?? [];
}
