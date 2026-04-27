import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { applyApprovedProposal } from "@/lib/agent/proposals";
import type { ProposalRow } from "@/lib/agent/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({ value: z.unknown().optional() });

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

  let body: { value?: unknown };
  try {
    body = Body.parse(await req.json().catch(() => ({})));
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "bad request" },
      { status: 400 }
    );
  }

  const sb = supabaseService();
  const { data, error } = await sb
    .from("agent_proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const proposal = data as ProposalRow;
  if (proposal.status !== "pending") {
    return NextResponse.json(
      { ok: false, error: `Already ${proposal.status}` },
      { status: 409 }
    );
  }

  // If a `value` is present in the body, this is "edit & approve". Otherwise,
  // the proposed_value is what we apply.
  const isEdited = Object.prototype.hasOwnProperty.call(body, "value");
  const valueToApply = isEdited ? body.value : proposal.proposed_value;

  const apply = await applyApprovedProposal(proposal, valueToApply);
  if (!apply.ok) {
    return NextResponse.json({ ok: false, error: apply.error }, { status: 502 });
  }

  const finalStatus = isEdited ? "edited_and_approved" : "approved";
  const upd = await sb
    .from("agent_proposals")
    .update({
      status: finalStatus,
      resolved_at: new Date().toISOString(),
      resolved_by: userEmail,
      resolved_value: valueToApply ?? null
    })
    .eq("id", proposalId);
  if (upd.error) {
    // The target write succeeded but bookkeeping failed. Don't 500 — the UI
    // would re-show the proposal. Surface as a non-fatal warning.
    return NextResponse.json({ ok: true, warning: upd.error.message });
  }

  return NextResponse.json({ ok: true, status: finalStatus });
}
