import { createTwoFilesPatch } from "diff";
import { supabaseService } from "@/lib/supabase/server";
import { generateBrief, type BriefInput } from "./runner";

export type EvalBriefResult = {
  brief_date: string;
  original: string;
  candidate: string;
  diff: string;
  modelOriginal: string;
  modelCandidate: string;
};

/**
 * Replay a stored brief against a (possibly different) prompt or model. The
 * stored `signals_snapshot` and `findings_snapshot` are what made the original
 * brief reproducible — re-feed them to the model and diff outputs.
 *
 * Spec §10. We deliberately do NOT mutate `agent_brief_log`; eval is read-only.
 */
export async function evalBrief(opts: {
  brief_date: string;
  prompt_override?: string;
  model_override?: string;
}): Promise<EvalBriefResult> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("agent_brief_log")
    .select("*")
    .eq("brief_date", opts.brief_date)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No brief on file for ${opts.brief_date}`);

  // Reconstruct a plausible BriefInput from the stored snapshot. We don't
  // store the full item summaries (those rotate fast) — eval is for the prompt
  // shape and tone, not for testing against historical item state.
  const stored = data as {
    body_md: string;
    model_used: string;
    signals_snapshot: BriefInput["signals"] | null;
    findings_snapshot: BriefInput["openFindings"] | null;
  };
  const today = new Date(opts.brief_date + "T07:05:00.000Z");
  const input: BriefInput = {
    today,
    currentRelease: null, // not stored on the log row; the prompt template tolerates "none"
    recentChanges: [],
    newlyBlocked: [],
    newlyDone: [],
    signals: stored.signals_snapshot ?? [],
    openFindings: stored.findings_snapshot ?? [],
    pendingProposalCount: 0,
    itemSummaries: []
  };

  const candidate = await generateBrief(input, {
    promptOverride: opts.prompt_override,
    modelOverride: opts.model_override
  });

  const diff = createTwoFilesPatch(
    `${opts.brief_date}.original.md`,
    `${opts.brief_date}.candidate.md`,
    stored.body_md,
    candidate.bodyMd,
    "stored",
    "candidate"
  );

  return {
    brief_date: opts.brief_date,
    original: stored.body_md,
    candidate: candidate.bodyMd,
    diff,
    modelOriginal: stored.model_used,
    modelCandidate: candidate.modelUsed
  };
}
