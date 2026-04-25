import { supabaseService } from "@/lib/supabase/server";
import { pullFromSheets } from "@/lib/sheets/adapter";
import type { AliasMap } from "@/lib/normalize/owners";
import type { Experiment, NormalizationWarning, PlanningItem, Release } from "@/lib/types";

/**
 * Full sync job. Runs on the Vercel cron and /api/refresh.
 * Idempotent per run — returns early if another run is already in progress.
 */
export async function runSync(): Promise<{
  ok: boolean;
  planningRows: number;
  experimentsRows: number;
  warnings: number;
  error?: string;
  skipped?: boolean;
}> {
  const sb = supabaseService();

  // Skip if a run started within the last 4 min and hasn't finished
  const { data: running } = await sb
    .from("sync_log")
    .select("id, started_at, finished_at")
    .is("finished_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (running && Date.now() - new Date(running.started_at as string).getTime() < 4 * 60_000) {
    return { ok: true, planningRows: 0, experimentsRows: 0, warnings: 0, skipped: true };
  }

  const { data: logRow, error: logErr } = await sb
    .from("sync_log")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (logErr || !logRow) throw logErr ?? new Error("Failed to open sync_log row");
  const logId = logRow.id as number;

  try {
    const aliases = await loadAliases(sb);
    const { planning, experiments, releases, warnings } = await pullFromSheets(aliases);
    await writeCache(sb, planning, experiments, releases);
    await sb
      .from("sync_log")
      .update({
        finished_at: new Date().toISOString(),
        status: warnings.length ? "partial" : "ok",
        planning_rows: planning.length,
        experiments_rows: experiments.length,
        normalization_warnings: warnings as unknown as Record<string, unknown>
      })
      .eq("id", logId);

    return { ok: true, planningRows: planning.length, experimentsRows: experiments.length, warnings: warnings.length };
  } catch (err) {
    const error = formatSyncError(err);
    await sb
      .from("sync_log")
      .update({ finished_at: new Date().toISOString(), status: "error", error_message: error })
      .eq("id", logId);
    return { ok: false, planningRows: 0, experimentsRows: 0, warnings: 0, error };
  }
}

function formatSyncError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function loadAliases(sb: ReturnType<typeof supabaseService>): Promise<AliasMap> {
  const { data, error } = await sb.from("name_aliases").select("alias, canonical_email");
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.canonical_email) map.set(row.alias.toLowerCase(), row.canonical_email);
  }
  return map;
}

type Sb = ReturnType<typeof supabaseService>;

async function writeCache(
  sb: Sb,
  planning: PlanningItem[],
  experiments: Experiment[],
  releases: Release[]
): Promise<void> {
  // Strategy: delete-then-upsert inside a transaction is ideal, but supabase-js does
  // not expose Postgres transactions from the client. We rely on:
  //   1) a full `delete()` pass,
  //   2) then an `upsert()` pass.
  // Reads are authenticated-only and acceptable staleness is fine for a 5-min window.

  await sb.from("planning_items").delete().not("id", "is", null);
  if (planning.length > 0) {
    const rows = planning.map((p) => ({
      id: p.id,
      sheet_row: p.sheetRow,
      name: p.name,
      release: p.release,
      seq: p.seq,
      status: p.status,
      status_raw: p.statusRaw,
      type: p.type,
      category: p.category,
      subsystem: p.subsystem,
      parent_epic: p.parentEpic,
      parent_epic_id: p.parentEpicId,
      links: p.links,
      rank_score: p.rankScore,
      priority: p.priority,
      impact: p.impact,
      difficulty: p.difficulty,
      experiments_refs: p.experimentsRefs,
      r_emails: p.rEmails,
      a_emails: p.aEmails,
      d_emails: p.dEmails,
      r_raw: p.rRaw,
      a_raw: p.aRaw,
      d_raw: p.dRaw,
      due_date: p.dueDate,
      comments: p.comments,
      dod: p.dod,
      blocker: p.blocker,
      blocked_since: p.blockedSince,
      is_ready: p.isReady,
      row_hash: p.rowHash,
      synced_at: new Date().toISOString()
    }));
    // FK parent_epic_id self-references planning_items; insert with null first,
    // then a second pass updates the references.
    const first = rows.map((r) => ({ ...r, parent_epic_id: null }));
    const insertErr = (await sb.from("planning_items").insert(first)).error;
    if (insertErr) throw insertErr;
    const updates = rows.filter((r) => r.parent_epic_id !== null);
    for (const u of updates) {
      const err = (await sb.from("planning_items").update({ parent_epic_id: u.parent_epic_id }).eq("id", u.id)).error;
      if (err) throw err;
    }
  }

  await sb.from("experiments").delete().not("key", "is", null);
  if (experiments.length > 0) {
    const rows = experiments.map((e) => ({
      key: e.key,
      sheet_row: e.sheetRow,
      problem: e.problem,
      problem_planning_id: e.problemPlanningId,
      experiment: e.experiment,
      question: e.question,
      scope: e.scope,
      details: e.details,
      status: e.status,
      status_raw: e.statusRaw,
      notes: e.notes,
      synced_at: new Date().toISOString()
    }));
    const err = (await sb.from("experiments").insert(rows)).error;
    if (err) throw err;
  }

  if (releases.length > 0) {
    const rows = releases.map((r) => ({
      name: r.name,
      planned_staging: r.plannedStaging,
      revised_staging: r.revisedStaging,
      actual_staging: r.actualStaging,
      planned_prod: r.plannedProd,
      revised_prod: r.revisedProd,
      actual_prod: r.actualProd
    }));
    const err = (await sb.from("releases").upsert(rows, { onConflict: "name" })).error;
    if (err) throw err;
  }
}

export { NormalizationWarning };
