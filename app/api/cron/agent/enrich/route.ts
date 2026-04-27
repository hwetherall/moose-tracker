import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { buildAgentContext } from "@/lib/agent/context";
import {
  pickEnrichmentCandidates,
  persistEnrichmentProposals,
  runEnrichmentForItem,
  touchEnrichmentRun
} from "@/lib/agent/enrich/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Bumped from default 60s — enrichment makes one Sonnet call per item, capped
// at 10 items per run with light concurrency.
export const maxDuration = 300;

const ITEMS_PER_RUN = 10;
const CONCURRENCY = 3;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ctx = await buildAgentContext();
  const candidates = pickEnrichmentCandidates(ctx.items, ctx.enrichments, ITEMS_PER_RUN);
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, candidates: 0, proposalsWritten: 0 });
  }

  let proposalsWritten = 0;
  let modelFailures = 0;

  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (row) => {
        const out = await runEnrichmentForItem(row, ctx);
        if (!out) return { itemId: row.id, written: 0, ok: false };
        const persist = await persistEnrichmentProposals(row.id, out.parsed, ctx.enrichments);
        await touchEnrichmentRun(row.id);
        return { itemId: row.id, written: persist.written, ok: true };
      })
    );
    for (const r of results) {
      if (!r.ok) modelFailures++;
      proposalsWritten += r.written;
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    proposalsWritten,
    modelFailures
  });
}
