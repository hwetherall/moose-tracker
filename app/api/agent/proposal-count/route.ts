import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchPendingProposalCount } from "@/lib/queries/agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  if (!userEmail.endsWith("@innovera.ai")) {
    return NextResponse.json({ count: 0 });
  }
  const count = await fetchPendingProposalCount();
  return NextResponse.json({ count });
}
