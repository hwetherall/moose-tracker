import { supabaseService } from "@/lib/supabase/server";
import type { AgentContext } from "../types";
import type { InspectorCheck, InspectorFinding } from "./types";
import {
  blockedSinceWithoutBlocked,
  blockedWithoutBlocker,
  blockerWithoutBlocked,
  doneWithFutureDue,
  futureBlockedSince,
  inDevWithoutDoD,
  malformedJiraLink,
  orphanEpic,
  statusChurn,
  statusParentMismatch,
  unknownOwner,
  unknownStatus
} from "./checks";

export function buildChecks(ctx: AgentContext): InspectorCheck[] {
  // The InDev-without-DoD check needs visibility into approved acceptance
  // criteria, which live on item_enrichment. Pre-build that map once.
  const acByItem = new Map<number, { text: string; done: boolean }[]>();
  for (const e of ctx.enrichments.values()) {
    if (e.acceptance_criteria_approved_at && e.acceptance_criteria.length > 0) {
      acByItem.set(e.item_id, e.acceptance_criteria);
    }
  }
  return [
    statusParentMismatch,
    orphanEpic,
    unknownStatus,
    unknownOwner,
    malformedJiraLink,
    blockedWithoutBlocker,
    blockerWithoutBlocked,
    blockedSinceWithoutBlocked,
    inDevWithoutDoD(acByItem),
    futureBlockedSince,
    doneWithFutureDue,
    statusChurn
  ];
}

export function runChecks(ctx: AgentContext): InspectorFinding[] {
  const out: InspectorFinding[] = [];
  for (const check of buildChecks(ctx)) {
    try {
      out.push(...check(ctx));
    } catch (e) {
      // Per spec §11: per-check try/catch. One bad check doesn't abort the sweep.
      console.warn("[inspector] check threw", e);
    }
  }
  return out;
}

/**
 * Persist the sweep:
 *   - new (check_id, item_id) → INSERT
 *   - existing open finding still firing → UPDATE last_seen_at
 *   - existing open finding no longer firing → resolved_at = now()
 *   - findings with suggested_fix → also write/refresh agent_proposals
 */
export async function persistSweep(findings: InspectorFinding[]): Promise<{
  inserted: number;
  updated: number;
  resolved: number;
  proposalsWritten: number;
}> {
  const sb = supabaseService();
  const now = new Date().toISOString();

  const open = await sb.from("agent_findings").select("*").is("resolved_at", null);
  if (open.error) throw open.error;

  const openByKey = new Map<string, { id: number }>();
  for (const row of open.data ?? []) {
    openByKey.set(`${row.check_id}::${row.item_id}`, { id: row.id });
  }

  const seen = new Set<string>();
  let inserted = 0;
  let updated = 0;

  for (const finding of findings) {
    const key = `${finding.check_id}::${finding.item_id}`;
    seen.add(key);
    const existing = openByKey.get(key);
    if (existing) {
      const upd = await sb
        .from("agent_findings")
        .update({ last_seen_at: now, severity: finding.severity, title: finding.title, detail: finding.detail })
        .eq("id", existing.id);
      if (!upd.error) updated++;
    } else {
      const ins = await sb.from("agent_findings").insert({
        check_id: finding.check_id,
        item_id: finding.item_id,
        severity: finding.severity,
        title: finding.title,
        detail: finding.detail,
        first_seen_at: now,
        last_seen_at: now
      });
      if (!ins.error) inserted++;
    }
  }

  // Resolve anything that was open before this sweep but didn't fire this time.
  let resolved = 0;
  for (const [key, row] of openByKey) {
    if (seen.has(key)) continue;
    const upd = await sb
      .from("agent_findings")
      .update({ resolved_at: now })
      .eq("id", row.id);
    if (!upd.error) resolved++;
  }

  // suggested_fix → proposals
  let proposalsWritten = 0;
  for (const finding of findings) {
    if (!finding.suggested_fix) continue;
    const fix = finding.suggested_fix;
    const source = `inspector:${finding.check_id}`;
    // Idempotency: skip if a pending proposal already exists for this (item, field)
    // from this same source. Otherwise we'd churn the queue every 15 min.
    const existing = await sb
      .from("agent_proposals")
      .select("id")
      .eq("item_id", finding.item_id)
      .eq("field", fix.field)
      .eq("status", "pending")
      .eq("source", source)
      .maybeSingle();
    if (existing.data) continue;

    // Supersede any other-source pending proposal on same (item, field).
    await sb
      .from("agent_proposals")
      .update({ status: "superseded", resolved_at: now })
      .eq("item_id", finding.item_id)
      .eq("field", fix.field)
      .eq("status", "pending");

    const ins = await sb.from("agent_proposals").insert({
      proposal_type: "inspector_fix",
      item_id: finding.item_id,
      field: fix.field,
      current_value: fix.current_value,
      proposed_value: fix.proposed_value,
      rationale: fix.rationale,
      source,
      generated_by_model: null,
      status: "pending"
    });
    if (!ins.error) proposalsWritten++;
  }

  return { inserted, updated, resolved, proposalsWritten };
}
