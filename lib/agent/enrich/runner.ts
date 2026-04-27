import { z } from "zod";
import { supabaseService } from "@/lib/supabase/server";
import type { Row } from "@/lib/queries/planning";
import { callAgentModel, AGENT_MODEL } from "../model";
import type { AgentContext, ItemEnrichmentRow } from "../types";
import { buildEnrichmentItemContext } from "./context";
import { ENRICHMENT_SYSTEM_PROMPT } from "./prompt";

const EnrichmentOutput = z.object({
  brief: z.string().nullable().optional(),
  acceptance_criteria: z
    .array(z.object({ text: z.string() }))
    .nullable()
    .optional(),
  effort_estimate: z.enum(["XS", "S", "M", "L", "XL"]).nullable().optional(),
  risk_level: z.enum(["low", "medium", "high"]).nullable().optional(),
  risk_rationale: z.string().nullable().optional(),
  related_item_ids: z.array(z.number().int()).nullable().optional()
});
export type EnrichmentOutput = z.infer<typeof EnrichmentOutput>;

const PROPOSABLE_FIELDS = [
  "brief",
  "acceptance_criteria",
  "effort_estimate",
  "risk_level",
  "risk_rationale",
  "related_item_ids"
] as const;
type Field = (typeof PROPOSABLE_FIELDS)[number];

const BRIEF_MAX_CHARS = 600;
const RISK_RATIONALE_MAX_CHARS = 200;
const RELATED_MAX = 5;

/**
 * Run enrichment for a single item. Returns the parsed output (already
 * sanitized to the fields we'll propose) or null on a parse/model failure.
 * Does not write to Supabase — the caller is responsible for that, since the
 * cron path and the on-demand path differ slightly.
 */
export async function runEnrichmentForItem(
  row: Row,
  ctx: AgentContext
): Promise<{
  parsed: EnrichmentOutput;
  inputTokens: number | null;
  outputTokens: number | null;
} | null> {
  const itemContext = buildEnrichmentItemContext(row, ctx);
  const userPrompt = `Item context:\n${JSON.stringify(itemContext, null, 2)}\n\nReturn the JSON object now.`;

  let response;
  try {
    response = await callAgentModel(
      [
        { role: "system", content: ENRICHMENT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      { responseFormat: "json_object", temperature: 0.2 }
    );
  } catch (e) {
    console.warn(`[enrich] model call failed for item ${row.id}`, e);
    return null;
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(response.content);
  } catch {
    console.warn(`[enrich] model returned non-JSON for item ${row.id}`);
    return null;
  }

  const result = EnrichmentOutput.safeParse(parsedRaw);
  if (!result.success) {
    console.warn(`[enrich] zod parse failed for item ${row.id}`, result.error.issues);
    return null;
  }

  return {
    parsed: sanitize(result.data),
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens
  };
}

function sanitize(out: EnrichmentOutput): EnrichmentOutput {
  return {
    brief: trimNullable(out.brief, BRIEF_MAX_CHARS),
    acceptance_criteria:
      out.acceptance_criteria?.length
        ? out.acceptance_criteria
            .map((c) => ({ text: c.text.trim() }))
            .filter((c) => c.text.length > 0)
            .slice(0, 5)
        : null,
    effort_estimate: out.effort_estimate ?? null,
    risk_level: out.risk_level ?? null,
    risk_rationale: out.risk_level
      ? trimNullable(out.risk_rationale, RISK_RATIONALE_MAX_CHARS)
      : null,
    related_item_ids:
      out.related_item_ids?.length
        ? Array.from(new Set(out.related_item_ids)).slice(0, RELATED_MAX)
        : null
  };
}

function trimNullable(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * Pick candidate items per spec §2.3:
 *   - no enrichment row at all, OR
 *   - row_hash on planning_items has changed since item_enrichment.updated_at.
 *
 * Cap at `limit`. Older candidates first (least-recently-enriched first) so we
 * cycle through the backlog rather than re-enriching the most-changed items.
 */
export function pickEnrichmentCandidates(
  items: Row[],
  enrichments: Map<number, ItemEnrichmentRow>,
  limit: number
): Row[] {
  const stalenessOf = (r: Row): number => {
    const e = enrichments.get(r.id);
    if (!e) return 0; // never enriched — highest priority
    return new Date(e.updated_at).getTime();
  };
  const candidates: Row[] = [];
  for (const r of items) {
    const e = enrichments.get(r.id);
    if (!e) {
      candidates.push(r);
      continue;
    }
    if (r.synced_at && new Date(r.synced_at) > new Date(e.updated_at)) {
      // The item changed since we last enriched it. Even if no fields look
      // novel we re-run, since our prompt input depends on the row's content.
      candidates.push(r);
    }
  }
  return candidates.sort((a, b) => stalenessOf(a) - stalenessOf(b)).slice(0, limit);
}

/**
 * Persist the enrichment run as a set of `agent_proposals` rows. Each non-null
 * field becomes one pending proposal. Existing pending proposals on the same
 * (item, field) are superseded by the new value (unique-pending invariant).
 */
export async function persistEnrichmentProposals(
  itemId: number,
  parsed: EnrichmentOutput,
  enrichments: Map<number, ItemEnrichmentRow>
): Promise<{ written: number }> {
  const sb = supabaseService();
  const existing = enrichments.get(itemId);
  const fieldValues: Partial<Record<Field, unknown>> = {
    brief: parsed.brief ?? undefined,
    acceptance_criteria: parsed.acceptance_criteria ?? undefined,
    effort_estimate: parsed.effort_estimate ?? undefined,
    risk_level: parsed.risk_level ?? undefined,
    risk_rationale: parsed.risk_rationale ?? undefined,
    related_item_ids: parsed.related_item_ids ?? undefined
  };

  let written = 0;
  for (const field of PROPOSABLE_FIELDS) {
    const proposed = fieldValues[field];
    if (proposed === undefined || proposed === null) continue;

    const current = currentValueFor(field, existing);
    if (sameValue(current, proposed)) continue; // already at this value, no proposal

    // Supersede any existing pending proposal on this (item, field).
    const supersede = await sb
      .from("agent_proposals")
      .update({ status: "superseded", resolved_at: new Date().toISOString() })
      .eq("item_id", itemId)
      .eq("field", field)
      .eq("status", "pending");
    if (supersede.error) {
      console.warn(`[enrich] supersede failed item ${itemId} field ${field}`, supersede.error);
      continue;
    }

    const ins = await sb.from("agent_proposals").insert({
      proposal_type: "enrichment",
      item_id: itemId,
      field,
      current_value: current ?? null,
      proposed_value: proposed,
      rationale: rationaleFor(field, proposed),
      source: "enrichment",
      generated_by_model: AGENT_MODEL,
      status: "pending"
    });
    if (ins.error) {
      console.warn(`[enrich] insert proposal failed item ${itemId} field ${field}`, ins.error);
      continue;
    }
    written++;
  }
  return { written };
}

function currentValueFor(field: Field, existing: ItemEnrichmentRow | undefined): unknown {
  if (!existing) return null;
  switch (field) {
    case "brief":
      return existing.brief;
    case "acceptance_criteria":
      return existing.acceptance_criteria;
    case "effort_estimate":
      return existing.effort_estimate;
    case "risk_level":
      return existing.risk_level;
    case "risk_rationale":
      return existing.risk_rationale;
    case "related_item_ids":
      return existing.related_item_ids;
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function rationaleFor(field: Field, _value: unknown): string {
  switch (field) {
    case "brief":
      return "Drafted from item context (name, dod, comments, history).";
    case "acceptance_criteria":
      return "Structured from the item's Definition of Done and brief.";
    case "effort_estimate":
      return "Estimated from item difficulty, scope, and similar items.";
    case "risk_level":
      return "Flagged based on blockers, dependencies, and difficulty.";
    case "risk_rationale":
      return "Rationale paired with the proposed risk level.";
    case "related_item_ids":
      return "Identified from rank-nearby items in the same category.";
  }
}

/**
 * Touch `item_enrichment.updated_at` to record that we tried — useful so the
 * candidate picker doesn't keep re-running on the same item that genuinely has
 * nothing left to propose. Only call after a successful run (parsed output).
 */
export async function touchEnrichmentRun(itemId: number): Promise<void> {
  const sb = supabaseService();
  // Use upsert so the first-ever run creates the row; subsequent runs bump
  // updated_at without disturbing approved values.
  const existing = await sb
    .from("item_enrichment")
    .select("item_id")
    .eq("item_id", itemId)
    .maybeSingle();
  if (existing.data) {
    await sb
      .from("item_enrichment")
      .update({ updated_at: new Date().toISOString() })
      .eq("item_id", itemId);
  } else {
    await sb.from("item_enrichment").insert({ item_id: itemId });
  }
}
