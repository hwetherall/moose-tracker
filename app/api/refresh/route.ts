import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runSync } from "@/lib/sync/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if (!session?.user?.email?.endsWith("@innovera.ai")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runSync();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
