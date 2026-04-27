import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { buildAgentContext } from "@/lib/agent/context";
import {
  buildBriefInput,
  generateBrief,
  persistBrief,
  persistBriefFailure
} from "@/lib/agent/brief/runner";
import { fetchAllOpenFindings, fetchPendingProposalCount } from "@/lib/queries/agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date();
  try {
    const [ctx, openFindings, pendingCount] = await Promise.all([
      buildAgentContext(),
      fetchAllOpenFindings(),
      fetchPendingProposalCount()
    ]);
    const input = buildBriefInput(ctx, openFindings, pendingCount);
    const run = await generateBrief(input);
    await persistBrief(today, run, input);
    return NextResponse.json({
      ok: true,
      brief_date: today.toISOString().slice(0, 10),
      model: run.modelUsed,
      input_tokens: run.inputTokens,
      output_tokens: run.outputTokens
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await persistBriefFailure(today, message);
    // Per spec §11: catch and log; the next run goes normally.
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
