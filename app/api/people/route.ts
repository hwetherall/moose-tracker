import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchPeople } from "@/lib/queries/releases";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email?.endsWith("@innovera.ai")) {
    return NextResponse.json({ people: [] });
  }
  const people = await fetchPeople();
  return NextResponse.json({ people });
}
