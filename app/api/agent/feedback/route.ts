import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  target_type: z.enum(["finding", "proposal", "brief"]),
  target_id: z.string().min(1).max(64),
  reaction: z.enum(["thumbs_up", "thumbs_down", "rejected"]),
  reason: z.string().max(500).optional()
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  if (!userEmail.endsWith("@innovera.ai")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "bad request" },
      { status: 400 }
    );
  }

  const sb = supabaseService();
  const { error } = await sb.from("agent_feedback").insert({
    user_email: userEmail,
    target_type: body.target_type,
    target_id: body.target_id,
    reaction: body.reaction,
    reason: body.reason ?? null
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
