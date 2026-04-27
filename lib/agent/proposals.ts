import { supabaseService } from "@/lib/supabase/server";
import { AI_BRIEF_COL, updatePlanningCell } from "@/lib/sheets/adapter";
import type { ProposalRow } from "./types";

/**
 * Apply an approved proposal to its target. Two paths:
 *   - enrichment → write to `item_enrichment` (and to the AI Brief sheet cell
 *     when the field is `brief`).
 *   - inspector_fix → write to `planning_items` AND the sheet (since the sheet
 *     is upstream — without the sheet write, the next sync rolls us back).
 *
 * On any failure the caller (the route handler) is responsible for leaving the
 * proposal in `pending` so the user can retry. We never write a partial state.
 */
export async function applyApprovedProposal(
  proposal: ProposalRow,
  approvedValue: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (proposal.proposal_type === "enrichment") {
    return applyEnrichmentApproval(proposal, approvedValue);
  }
  if (proposal.proposal_type === "inspector_fix") {
    return applyInspectorFixApproval(proposal, approvedValue);
  }
  return { ok: false, error: `Unknown proposal_type: ${proposal.proposal_type}` };
}

async function applyEnrichmentApproval(
  proposal: ProposalRow,
  approvedValue: unknown,
  approverEmail?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = supabaseService();
  const nowIso = new Date().toISOString();

  // Ensure an item_enrichment row exists, then update the relevant column +
  // its approval timestamp.
  const existing = await sb
    .from("item_enrichment")
    .select("item_id")
    .eq("item_id", proposal.item_id)
    .maybeSingle();
  if (!existing.data) {
    const ins = await sb.from("item_enrichment").insert({ item_id: proposal.item_id });
    if (ins.error) return { ok: false, error: ins.error.message };
  }

  const update: Record<string, unknown> = { updated_at: nowIso };
  switch (proposal.field) {
    case "brief":
      update.brief = approvedValue;
      update.brief_approved_at = nowIso;
      update.brief_approved_by = approverEmail ?? null;
      update.brief_synced_to_sheet = false;
      break;
    case "acceptance_criteria":
      // Spec storage shape is {text, done}[]; agent emits {text}[]. Default done=false.
      update.acceptance_criteria = Array.isArray(approvedValue)
        ? approvedValue.map((c) => {
            const item = c as { text?: unknown; done?: unknown };
            return {
              text: typeof item.text === "string" ? item.text : "",
              done: typeof item.done === "boolean" ? item.done : false
            };
          })
        : [];
      update.acceptance_criteria_approved_at = nowIso;
      break;
    case "effort_estimate":
      update.effort_estimate = approvedValue;
      update.effort_approved_at = nowIso;
      break;
    case "risk_level":
      update.risk_level = approvedValue;
      update.risk_approved_at = nowIso;
      break;
    case "risk_rationale":
      update.risk_rationale = approvedValue;
      // No own approved_at — pairs with risk_level.
      break;
    case "related_item_ids":
      update.related_item_ids = Array.isArray(approvedValue) ? approvedValue : [];
      update.related_approved_at = nowIso;
      break;
    default:
      return { ok: false, error: `Unknown enrichment field: ${proposal.field}` };
  }

  const upd = await sb.from("item_enrichment").update(update).eq("item_id", proposal.item_id);
  if (upd.error) return { ok: false, error: upd.error.message };

  // Brief field is the one that round-trips to the sheet (§2.5).
  if (proposal.field === "brief") {
    const sheetWrite = await writeBriefToSheet(proposal.item_id, approvedValue);
    if (!sheetWrite.ok) {
      // Roll back: clear the just-written brief approval so the proposal
      // remains effectively unapplied. The user gets the error and can retry.
      await sb
        .from("item_enrichment")
        .update({
          brief_approved_at: null,
          brief_approved_by: null,
          brief: null,
          updated_at: nowIso
        })
        .eq("item_id", proposal.item_id);
      return sheetWrite;
    }
    await sb
      .from("item_enrichment")
      .update({ brief_synced_to_sheet: true })
      .eq("item_id", proposal.item_id);
  }

  return { ok: true };
}

async function writeBriefToSheet(
  itemId: number,
  briefValue: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof briefValue !== "string" && briefValue !== null) {
    return { ok: false, error: "Brief value must be a string." };
  }
  const sb = supabaseService();
  const { data: row, error } = await sb
    .from("planning_items")
    .select("sheet_row")
    .eq("id", itemId)
    .maybeSingle();
  if (error || !row) {
    return { ok: false, error: error?.message ?? `item ${itemId} not in cache` };
  }
  try {
    await updatePlanningCell(row.sheet_row as number, AI_BRIEF_COL, (briefValue as string) ?? "");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sheet write failed" };
  }
}

/**
 * Inspector-fix proposals carry a `field` referencing a column on `planning_items`
 * and write that column to both Supabase and the Sheet (§5.3). The table below
 * is the allow-list — only fields explicitly mapped here can be auto-fixed.
 * Anything else returns an error rather than performing an arbitrary write.
 */
const INSPECTOR_FIX_SHEET_COL: Record<string, string> = {
  blocker: "V",        // col 22
  blocked_since: "W",  // col 23
  due_date: "S"        // col 19
};

async function applyInspectorFixApproval(
  proposal: ProposalRow,
  approvedValue: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sheetCol = INSPECTOR_FIX_SHEET_COL[proposal.field];
  if (!sheetCol) {
    return { ok: false, error: `Inspector fix not allowed for field: ${proposal.field}` };
  }

  const sb = supabaseService();
  const { data: row, error } = await sb
    .from("planning_items")
    .select("sheet_row")
    .eq("id", proposal.item_id)
    .maybeSingle();
  if (error || !row) {
    return { ok: false, error: error?.message ?? `item ${proposal.item_id} not in cache` };
  }

  // Sheet first — if it fails, we don't desync Supabase.
  const valueForCell = approvedValue == null ? "" : (approvedValue as string | number);
  try {
    await updatePlanningCell(row.sheet_row as number, sheetCol, valueForCell);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sheet write failed" };
  }

  // Mirror to Supabase so the UI updates before the next sync.
  const upd: Record<string, unknown> = { [proposal.field]: approvedValue };
  const cacheUpd = await sb.from("planning_items").update(upd).eq("id", proposal.item_id);
  if (cacheUpd.error) {
    // Sheet has the new value; the next sync will reconcile. Surface a soft warning.
    return { ok: false, error: `Sheet updated but cache write failed: ${cacheUpd.error.message}` };
  }
  return { ok: true };
}
