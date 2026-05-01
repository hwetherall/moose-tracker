import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { updatePlanningCells } from "@/lib/sheets/adapter";
import { rowHash } from "@/lib/normalize/hash";
import { STATUSES, TYPES } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const nullableText = z.string().trim().transform((v) => (v.length ? v : null)).nullable();
const dateText = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

const Body = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  release: nullableText,
  seq: nullableText,
  status: z.enum(STATUSES),
  type: z.enum(TYPES).nullable(),
  category: z.string().trim().min(1, "Category is required"),
  subsystem: nullableText,
  parent_epic: nullableText,
  priority: z.number().int().min(1).max(3).nullable(),
  impact: z.number().int().min(1).max(3).nullable(),
  difficulty: z.number().int().min(1).max(4).nullable(),
  r_emails: z.array(z.string().email()).default([]),
  a_emails: z.array(z.string().email()).default([]),
  d_emails: z.array(z.string().email()).default([]),
  due_date: dateText,
  comments: nullableText,
  dod: nullableText,
  blocker: nullableText,
  blocked_since: dateText,
  ai_brief_from_sheet: nullableText
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  if (!userEmail.endsWith("@innovera.ai")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid item id" }, { status: 400 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues.map((i) => i.message).join("; ") : "Invalid body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const sb = supabaseService();
  const { data: current, error: currentError } = await sb
    .from("planning_items")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();
  if (currentError || !current) {
    return NextResponse.json(
      { ok: false, error: currentError?.message ?? `Item ${itemId} not found` },
      { status: 404 }
    );
  }

  const displayNames = await loadDisplayNames([...body.r_emails, ...body.a_emails, ...body.d_emails]);
  const namesOf = (emails: string[]) => emails.map((email) => displayNames.get(email) ?? email).join("/");
  const rankScore =
    body.priority !== null && body.impact !== null && body.difficulty !== null
      ? body.priority * 100 + body.impact * 10 + body.difficulty
      : null;

  try {
    await updatePlanningCells(current.sheet_row as number, [
      { column: "B", value: body.name },
      { column: "C", value: body.release },
      { column: "D", value: body.seq },
      { column: "E", value: body.status },
      { column: "F", value: body.type },
      { column: "G", value: body.category },
      { column: "H", value: body.subsystem },
      { column: "I", value: body.parent_epic },
      { column: "K", value: rankScore },
      { column: "L", value: body.priority },
      { column: "M", value: body.impact },
      { column: "O", value: body.difficulty },
      { column: "P", value: namesOf(body.r_emails) },
      { column: "Q", value: namesOf(body.a_emails) },
      { column: "R", value: namesOf(body.d_emails) },
      { column: "S", value: body.due_date },
      { column: "T", value: body.comments },
      { column: "U", value: body.dod },
      { column: "V", value: body.blocker },
      { column: "W", value: body.blocked_since },
      { column: "Y", value: body.ai_brief_from_sheet }
    ]);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Sheet update failed" },
      { status: 500 }
    );
  }

  const parentEpicId = await resolveParentEpicId(body.parent_epic, itemId);
  const links = (current.links as unknown[]) ?? [];
  const experimentsRefs = (current.experiments_refs as unknown[]) ?? [];
  const updatedForHash = {
    id: itemId,
    sheetRow: current.sheet_row,
    name: body.name,
    release: body.release,
    seq: body.seq,
    status: body.status,
    statusRaw: body.status,
    type: body.type,
    category: body.category,
    subsystem: body.subsystem,
    parentEpic: body.parent_epic,
    parentEpicId: null,
    links,
    rankScore,
    priority: body.priority,
    impact: body.impact,
    difficulty: body.difficulty,
    experimentsRefs,
    rEmails: body.r_emails,
    aEmails: body.a_emails,
    dEmails: body.d_emails,
    rRaw: namesOf(body.r_emails) || null,
    aRaw: namesOf(body.a_emails) || null,
    dRaw: namesOf(body.d_emails) || null,
    dueDate: body.due_date,
    comments: body.comments,
    dod: body.dod,
    blocker: body.blocker,
    blockedSince: body.blocked_since,
    isReady: current.is_ready
  };

  const cacheUpdate = {
    name: body.name,
    release: body.release,
    seq: body.seq,
    status: body.status,
    status_raw: body.status,
    type: body.type,
    category: body.category,
    subsystem: body.subsystem,
    parent_epic: body.parent_epic,
    parent_epic_id: parentEpicId,
    rank_score: rankScore,
    priority: body.priority,
    impact: body.impact,
    difficulty: body.difficulty,
    r_emails: body.r_emails,
    a_emails: body.a_emails,
    d_emails: body.d_emails,
    r_raw: namesOf(body.r_emails) || null,
    a_raw: namesOf(body.a_emails) || null,
    d_raw: namesOf(body.d_emails) || null,
    due_date: body.due_date,
    comments: body.comments,
    dod: body.dod,
    blocker: body.blocker,
    blocked_since: body.blocked_since,
    ai_brief_from_sheet: body.ai_brief_from_sheet,
    row_hash: rowHash(updatedForHash),
    synced_at: new Date().toISOString()
  };

  const { error: updateError } = await sb.from("planning_items").update(cacheUpdate).eq("id", itemId);
  if (updateError) {
    return NextResponse.json(
      { ok: false, error: `Sheet updated but Antler cache write failed: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

async function loadDisplayNames(emails: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(emails));
  const displayNames = new Map<string, string>();
  if (unique.length === 0) return displayNames;
  const sb = supabaseService();
  const { data } = await sb.from("people").select("email, display_name").in("email", unique);
  for (const p of data ?? []) {
    displayNames.set(p.email as string, p.display_name as string);
  }
  return displayNames;
}

async function resolveParentEpicId(parentEpic: string | null, itemId: number): Promise<number | null> {
  if (!parentEpic) return null;
  const sb = supabaseService();
  const { data } = await sb
    .from("planning_items")
    .select("id")
    .eq("name", parentEpic)
    .neq("id", itemId)
    .maybeSingle();
  return (data?.id as number | undefined) ?? null;
}
