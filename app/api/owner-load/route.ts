import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchPlanningItems } from "@/lib/queries/planning";
import { displayNameForEmail } from "@/lib/people";

export const dynamic = "force-dynamic";

const ACTIVE = ["1-InDev", "1-InDevPrompt", "2-ReadyForDev", "3-Discovery", "3-Design", "4-Experiment"];

export async function GET() {
  const session = await auth();
  if (!session?.user?.email?.endsWith("@innovera.ai")) {
    return NextResponse.json({ owners: [] });
  }
  const items = await fetchPlanningItems({});
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!ACTIVE.includes(item.status)) continue;
    for (const e of new Set([...item.r_emails, ...item.a_emails])) {
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
  }
  const owners = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([email, count]) => ({
      email,
      display_name: displayNameForEmail(email),
      count
    }));
  return NextResponse.json({ owners });
}
