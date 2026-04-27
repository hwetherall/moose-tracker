import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PutBody = z.object({
  suppressed_check_ids: z.array(z.string()).optional(),
  suppressed_signal_ids: z.array(z.string()).optional()
});

async function requireUser() {
  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  if (!userEmail.endsWith("@innovera.ai")) return null;
  return userEmail;
}

export async function GET() {
  const userEmail = await requireUser();
  if (!userEmail) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseService();
  const { data, error } = await sb
    .from("agent_preferences")
    .select("suppressed_check_ids, suppressed_signal_ids")
    .eq("user_email", userEmail)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    data ?? { suppressed_check_ids: [], suppressed_signal_ids: [] }
  );
}

export async function PUT(req: NextRequest) {
  const userEmail = await requireUser();
  if (!userEmail) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof PutBody>;
  try {
    body = PutBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad request" },
      { status: 400 }
    );
  }

  const sb = supabaseService();
  const upd: Record<string, unknown> = { user_email: userEmail, updated_at: new Date().toISOString() };
  if (body.suppressed_check_ids) upd.suppressed_check_ids = body.suppressed_check_ids;
  if (body.suppressed_signal_ids) upd.suppressed_signal_ids = body.suppressed_signal_ids;

  const { error } = await sb.from("agent_preferences").upsert(upd, { onConflict: "user_email" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
