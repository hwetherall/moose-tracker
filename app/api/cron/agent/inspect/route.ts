import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { buildAgentContext } from "@/lib/agent/context";
import { persistSweep, runChecks } from "@/lib/agent/inspector/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ctx = await buildAgentContext();
  const findings = runChecks(ctx);
  const stats = await persistSweep(findings);
  return NextResponse.json({ ok: true, found: findings.length, ...stats });
}
