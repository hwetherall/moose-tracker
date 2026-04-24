import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync/run";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runSync();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
