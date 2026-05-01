import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { EXTRACTION_MODEL } from "@/lib/voice/extract";
import type { VoiceSessionRow } from "@/lib/agent/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  brief: z.string().trim().min(1).max(600),
  acceptance_criteria: z
    .array(z.object({ text: z.string().trim().min(1) }))
    .min(1)
    .max(8)
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  if (!userEmail.endsWith("@innovera.ai")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ ok: false, error: "bad session id" }, { status: 400 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "bad request" },
      { status: 400 }
    );
  }

  const sb = supabaseService();
  const { data: rawSession, error: fetchErr } = await sb
    .from("voice_enrichment_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });
  }
  if (!rawSession) {
    return NextResponse.json({ ok: false, error: "session not found" }, { status: 404 });
  }
  const voiceSession = rawSession as VoiceSessionRow;
  if (voiceSession.user_email.toLowerCase() !== userEmail) {
    return NextResponse.json({ ok: false, error: "not your session" }, { status: 403 });
  }
  if (voiceSession.status !== "extracted") {
    return NextResponse.json(
      { ok: false, error: `session already ${voiceSession.status}` },
      { status: 409 }
    );
  }

  // Supersede any existing pending proposals on (item, brief) and (item, ac)
  // to satisfy the partial unique index in 0003_v2.sql before inserting the
  // voice proposals.
  const supersede = await sb
    .from("agent_proposals")
    .update({ status: "superseded", resolved_at: new Date().toISOString() })
    .eq("item_id", voiceSession.item_id)
    .in("field", ["brief", "acceptance_criteria"])
    .eq("status", "pending");
  if (supersede.error) {
    return NextResponse.json({ ok: false, error: supersede.error.message }, { status: 500 });
  }

  // Insert the two voice proposals.
  const rationale = `Drafted from a ${voiceSession.duration_seconds ?? 0}s voice recording.`;
  const inserts = [
    {
      proposal_type: "enrichment",
      item_id: voiceSession.item_id,
      field: "brief",
      current_value: null,
      proposed_value: body.brief.trim(),
      rationale,
      source: "voice",
      source_session_id: voiceSession.id,
      generated_by_model: EXTRACTION_MODEL,
      status: "pending"
    },
    {
      proposal_type: "enrichment",
      item_id: voiceSession.item_id,
      field: "acceptance_criteria",
      current_value: null,
      proposed_value: body.acceptance_criteria.map((c) => ({ text: c.text.trim() })),
      rationale,
      source: "voice",
      source_session_id: voiceSession.id,
      generated_by_model: EXTRACTION_MODEL,
      status: "pending"
    }
  ];

  const { data: written, error: insertErr } = await sb
    .from("agent_proposals")
    .insert(inserts)
    .select("id");
  if (insertErr) {
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
  }
  const proposalIds = (written ?? []).map((r) => (r as { id: number }).id);

  // Mark session submitted last — if it fails, the proposals exist (the user's
  // intent is preserved), and we'll heal the status on the next visit.
  const { error: markErr } = await sb
    .from("voice_enrichment_sessions")
    .update({ status: "submitted" })
    .eq("id", sessionId);
  if (markErr) {
    return NextResponse.json({
      ok: true,
      proposalIds,
      warning: `session status update failed: ${markErr.message}`
    });
  }

  return NextResponse.json({ ok: true, proposalIds });
}
