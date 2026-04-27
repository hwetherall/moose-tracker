import { marked } from "marked";
import { format } from "date-fns";
import { supabaseService } from "@/lib/supabase/server";
import { callAgentModel, AGENT_MODEL } from "../model";
import type { AgentContext, FindingRow } from "../types";
import { buildBriefSystemPrompt } from "./prompt";

const RECENT_HOURS = 24;
const RELEASE_ORDER = ["R14", "R15", "R16.1", "R16.2", "R17", "R18"];

export type BriefInput = {
  today: Date;
  currentRelease: string | null;
  recentChanges: Array<{ item_id: number; from: string | null; to: string; at: string }>;
  newlyBlocked: Array<{ item_id: number; at: string; blocker: string | null }>;
  newlyDone: Array<{ item_id: number; at: string }>;
  signals: Array<{ id: string; severity: string; title: string; body: string; affectedItemIds: number[] }>;
  openFindings: Array<Pick<FindingRow, "check_id" | "item_id" | "severity" | "title" | "detail">>;
  pendingProposalCount: number;
  itemSummaries: Array<{ id: number; name: string; status: string; release: string | null }>;
};

export function buildBriefInput(
  ctx: AgentContext,
  openFindings: FindingRow[],
  pendingProposalCount: number
): BriefInput {
  const cutoff = new Date(ctx.today.getTime() - RECENT_HOURS * 3_600_000);

  const recentChanges = ctx.statusChanges
    .filter((c) => new Date(c.changed_at) >= cutoff)
    .map((c) => ({
      item_id: c.item_id,
      from: c.from_status,
      to: c.to_status,
      at: c.changed_at
    }));

  const newlyBlocked = ctx.blockedEpisodes
    .filter((b) => !b.ended_at && new Date(b.started_at) >= cutoff)
    .map((b) => ({ item_id: b.item_id, at: b.started_at, blocker: b.blocker_text }));

  const newlyDone = recentChanges
    .filter((c) => c.to === "0-Done")
    .map((c) => ({ item_id: c.item_id, at: c.at }));

  const currentRelease =
    RELEASE_ORDER.find((r) =>
      ctx.items.some((i) => i.release === r && i.status !== "0-Done")
    ) ?? null;

  return {
    today: ctx.today,
    currentRelease,
    recentChanges,
    newlyBlocked,
    newlyDone,
    signals: ctx.signals.map((s) => ({
      id: s.id,
      severity: s.severity,
      title: s.title,
      body: s.body,
      affectedItemIds: s.affectedItemIds
    })),
    openFindings: openFindings.map((f) => ({
      check_id: f.check_id,
      item_id: f.item_id,
      severity: f.severity,
      title: f.title,
      detail: f.detail
    })),
    pendingProposalCount,
    itemSummaries: ctx.items.map((i) => ({
      id: i.id,
      name: i.name,
      status: i.status,
      release: i.release
    }))
  };
}

export type BriefRunResult = {
  bodyMd: string;
  bodyHtml: string;
  modelUsed: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

/**
 * Generate a brief from the input bundle. Deterministic boundary: the model
 * sees only this bundle. The eval harness replays a stored bundle to test
 * prompt changes.
 */
export async function generateBrief(
  input: BriefInput,
  opts: { promptOverride?: string; modelOverride?: string } = {}
): Promise<BriefRunResult> {
  const systemPrompt =
    opts.promptOverride ??
    buildBriefSystemPrompt({ today: input.today, currentRelease: input.currentRelease });
  const userPrompt = `Brief input:\n${JSON.stringify(serializeInputForModel(input), null, 2)}\n\nGenerate the markdown brief now.`;

  const result = await callAgentModel(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    { temperature: 0.4 }
  );

  const bodyMd = result.content.trim();
  const bodyHtml = await marked.parse(bodyMd, { gfm: true, breaks: false });

  return {
    bodyMd,
    bodyHtml,
    modelUsed: opts.modelOverride ?? result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens
  };
}

function serializeInputForModel(input: BriefInput) {
  // Keep the item summaries reasonably small — the model only needs id+name+
  // status, not the full row, since #IDs in the output get linkified by the UI.
  return {
    today: format(input.today, "yyyy-MM-dd"),
    current_release: input.currentRelease,
    recent_status_changes: input.recentChanges,
    newly_blocked: input.newlyBlocked,
    newly_done: input.newlyDone,
    signals: input.signals,
    open_findings: input.openFindings,
    pending_proposal_count: input.pendingProposalCount,
    items: input.itemSummaries
  };
}

/**
 * Persist a generated brief. Idempotent on `brief_date` — re-running the cron
 * for the same date overwrites (handy when retrying after a model error).
 */
export async function persistBrief(
  briefDate: Date,
  run: BriefRunResult,
  input: BriefInput
): Promise<void> {
  const sb = supabaseService();
  const dateStr = format(briefDate, "yyyy-MM-dd");
  await sb.from("agent_brief_log").upsert(
    {
      brief_date: dateStr,
      body_md: run.bodyMd,
      body_html: run.bodyHtml,
      model_used: run.modelUsed,
      input_token_count: run.inputTokens,
      output_token_count: run.outputTokens,
      signals_snapshot: input.signals,
      findings_snapshot: input.openFindings,
      delivery_metadata: {},
      error: null,
      generated_at: new Date().toISOString()
    },
    { onConflict: "brief_date" }
  );
}

/**
 * Persist a failure marker so the Overview hides the card and the cron path
 * has an audit trail. Spec §11.
 */
export async function persistBriefFailure(briefDate: Date, errorMessage: string): Promise<void> {
  const sb = supabaseService();
  const dateStr = format(briefDate, "yyyy-MM-dd");
  await sb.from("agent_brief_log").upsert(
    {
      brief_date: dateStr,
      body_md: "",
      body_html: "",
      model_used: AGENT_MODEL,
      error: errorMessage.slice(0, 1000),
      generated_at: new Date().toISOString()
    },
    { onConflict: "brief_date" }
  );
}
