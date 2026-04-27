import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email?.endsWith("@innovera.ai")) {
    return NextResponse.json({ epics: [] });
  }
  const sb = supabaseServer();
  const { data } = await sb
    .from("planning_items")
    .select("id, name")
    .eq("type", "Epic")
    .order("name");
  return NextResponse.json({ epics: data ?? [] });
}
