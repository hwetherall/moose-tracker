import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import type { VoiceSessionRow } from "@/lib/agent/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

const Body = z.object({ reason: z.string().max(120).optional() });

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
    body = Body.parse(await req.json().catch(() => ({})));
  } catch {
    body = {};
  }

  const sb = supabaseService();
  const { data: rawSession } = await sb
    .from("voice_enrichment_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!rawSession) {
    return NextResponse.json({ ok: false, error: "session not found" }, { status: 404 });
  }
  const voiceSession = rawSession as VoiceSessionRow;
  if (voiceSession.user_email.toLowerCase() !== userEmail) {
    return NextResponse.json({ ok: false, error: "not your session" }, { status: 403 });
  }

  await sb
    .from("voice_enrichment_sessions")
    .update({ status: "discarded", failure_reason: body.reason ?? null })
    .eq("id", sessionId);

  return new NextResponse(null, { status: 204 });
}
