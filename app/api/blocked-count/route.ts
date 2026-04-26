import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const sb = supabaseServer();
  const { count, error } = await sb
    .from("planning_items")
    .select("id", { count: "exact", head: true })
    .or("status.eq.0-Blocked,blocker.not.is.null");

  if (error) return NextResponse.json({ count: 0 }, { status: 500 });
  return NextResponse.json({ count: count ?? 0 });
}
