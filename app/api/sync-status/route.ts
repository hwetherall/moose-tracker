import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email?.endsWith("@innovera.ai")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = supabaseServer();
  const { data } = await sb
    .from("sync_log")
    .select("started_at, finished_at, status")
    .order("started_at", { ascending: false })
    .limit(10);
  const rows = data ?? [];
  const latest = rows[0];
  let consecutive = 0;
  for (const r of rows) {
    if (r.status === "error") consecutive += 1;
    else break;
  }
  return NextResponse.json({
    lastSyncedAt: latest?.finished_at ?? latest?.started_at ?? null,
    lastStatus: latest?.status ?? null,
    consecutiveFailures: consecutive
  });
}
