import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { appendPlanningRow } from "@/lib/sheets/adapter";
import { runSync } from "@/lib/sync/run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  type: z.enum(["Epic", "Story", "Task"]),
  status: z.enum(["5-Backlog", "3-Discovery", "2-ReadyForDev"]),
  category: z.string().min(1),
  subsystem: z.string().nullable().optional(),
  priority: z.number().int().min(1).max(3),
  impact: z.number().int().min(1).max(3),
  difficulty: z.number().int().min(1).max(4),
  release: z.string().nullable().optional(),
  r_emails: z.array(z.string().email()).default([]),
  a_emails: z.array(z.string().email()).default([]),
  d_emails: z.array(z.string().email()).default([]),
  due_date: z.string().nullable().optional(),
  dod: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
  parent_epic: z.string().nullable().optional()
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
    const message = e instanceof z.ZodError ? e.issues.map((i) => i.message).join("; ") : "Invalid body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const sb = supabaseService();

  // Duplicate-name check (case-insensitive). Block exact dupes; warn near-dupes.
  const { data: existing } = await sb.from("planning_items").select("id, name");
  const lowerName = body.name.toLowerCase();
  const exactDupe = existing?.find((e) => (e.name as string).toLowerCase() === lowerName);
  if (exactDupe) {
    return NextResponse.json(
      { ok: false, error: `An item named "${body.name}" already exists (#${exactDupe.id}).` },
      { status: 409 }
    );
  }

  const maxId = (existing ?? []).reduce((m, r) => Math.max(m, (r.id as number) ?? 0), 0);
  const nextId = maxId + 1;

  const rankScore = body.priority * 100 + body.impact * 10 + body.difficulty;

  // Resolve email → display_name for the sheet write (sheet expects names).
  const allEmails = [...body.r_emails, ...body.a_emails, ...body.d_emails];
  const displayNames = new Map<string, string>();
  if (allEmails.length > 0) {
    const { data: people } = await sb.from("people").select("email, display_name").in("email", allEmails);
    for (const p of people ?? []) {
      displayNames.set(p.email as string, p.display_name as string);
    }
  }

  try {
    await appendPlanningRow(
      {
        id: nextId,
        name: body.name.trim(),
        release: body.release ?? null,
        status: body.status,
        type: body.type,
        category: body.category,
        subsystem: body.subsystem ?? null,
        parentEpic: body.parent_epic ?? null,
        priority: body.priority,
        impact: body.impact,
        difficulty: body.difficulty,
        rankScore,
        rEmails: body.r_emails,
        aEmails: body.a_emails,
        dEmails: body.d_emails,
        dueDate: body.due_date ?? null,
        comments: body.comments ?? null,
        dod: body.dod ?? null
      },
      displayNames
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Sheet append failed" },
      { status: 500 }
    );
  }

  // Force a sync so the optimistic UI row reconciles in seconds, not minutes.
  // Don't fail the create if reconciliation fails — the row is in the sheet.
  let syncOk = true;
  try {
    const result = await runSync({ force: true });
    syncOk = result.ok;
  } catch {
    syncOk = false;
  }

  return NextResponse.json({ ok: true, id: nextId, syncOk });
}
