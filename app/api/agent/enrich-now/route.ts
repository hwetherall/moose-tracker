import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { buildAgentContext } from "@/lib/agent/context";
import {
  persistEnrichmentProposals,
  runEnrichmentForItem,
  touchEnrichmentRun
} from "@/lib/agent/enrich/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ item_id: z.number().int().positive() });

// In-memory throttle. Imperfect across Vercel instances, fine for a low-volume
// "Suggest one" button. Spec §8: 1/min/user.
const lastCallByUser = new Map<string, number>();
const WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  if (!userEmail.endsWith("@innovera.ai")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const last = lastCallByUser.get(userEmail);
  if (last && Date.now() - last < WINDOW_MS) {
    const wait = Math.ceil((WINDOW_MS - (Date.now() - last)) / 1000);
    return NextResponse.json(
      { ok: false, error: `Rate limit — try again in ${wait}s` },
      { status: 429 }
    );
  }
  lastCallByUser.set(userEmail, Date.now());

  let body;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "bad request" },
      { status: 400 }
    );
  }

  const ctx = await buildAgentContext();
  const row = ctx.items.find((i) => i.id === body.item_id);
  if (!row) {
    return NextResponse.json({ ok: false, error: "item not found" }, { status: 404 });
  }

  const out = await runEnrichmentForItem(row, ctx);
  if (!out) {
    return NextResponse.json(
      { ok: false, error: "Model call failed; check server logs." },
      { status: 502 }
    );
  }

  const { written } = await persistEnrichmentProposals(row.id, out.parsed, ctx.enrichments);
  await touchEnrichmentRun(row.id);
  return NextResponse.json({ ok: true, proposalsWritten: written });
}
