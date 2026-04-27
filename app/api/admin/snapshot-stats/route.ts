import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ADMINS = new Set(["harry@innovera.ai"]);

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? "";
  if (!ADMINS.has(email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = supabaseService();
  const [daily, statusChanges, blockedEpisodes, openEpisodes, latestSnapshot, chatLog] = await Promise.all([
    sb.from("planning_items_daily").select("snapshot_date", { count: "exact", head: true }),
    sb.from("status_changes").select("id", { count: "exact", head: true }),
    sb.from("blocked_episodes").select("id", { count: "exact", head: true }),
    sb.from("blocked_episodes").select("id", { count: "exact", head: true }).is("ended_at", null),
    sb
      .from("planning_items_daily")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from("chat_log").select("id", { count: "exact", head: true })
  ]);

  return NextResponse.json({
    ok: true,
    planning_items_daily_rows: daily.count ?? 0,
    latest_snapshot_date: latestSnapshot.data?.snapshot_date ?? null,
    status_changes_rows: statusChanges.count ?? 0,
    blocked_episodes_total: blockedEpisodes.count ?? 0,
    blocked_episodes_open: openEpisodes.count ?? 0,
    chat_log_rows: chatLog.count ?? 0
  });
}
