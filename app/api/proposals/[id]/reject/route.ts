import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ reason: z.string().max(500).optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  if (!userEmail.endsWith("@innovera.ai")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const proposalId = Number(id);
  if (!Number.isFinite(proposalId)) {
    return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  }

  let body: { reason?: string };
  try {
    body = Body.parse(await req.json().catch(() => ({})));
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "bad request" },
      { status: 400 }
    );
  }

  const sb = supabaseService();
  const upd = await sb
    .from("agent_proposals")
    .update({
      status: "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by: userEmail
    })
    .eq("id", proposalId)
    .eq("status", "pending");
  if (upd.error) return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });

  // Spec §6.4: rejection counts as implicit thumbs-down. Log it.
  await sb.from("agent_feedback").insert({
    user_email: userEmail,
    target_type: "proposal",
    target_id: String(proposalId),
    reaction: "rejected",
    reason: body.reason ?? null
  });

  return NextResponse.json({ ok: true });
}
