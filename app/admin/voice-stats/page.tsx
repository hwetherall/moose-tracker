import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ADMINS = new Set(["harry@innovera.ai"]);

type StatusCounts = {
  extracted: number;
  submitted: number;
  discarded: number;
  failed: number;
};

export default async function VoiceStatsPage() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? "";
  if (!email.endsWith("@innovera.ai")) redirect("/signin");
  if (!ADMINS.has(email)) redirect("/");

  const sb = supabaseService();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [allSessions, recentSessions, voiceProposals, allEnrichmentProposals] = await Promise.all([
    sb.from("voice_enrichment_sessions").select("status"),
    sb
      .from("voice_enrichment_sessions")
      .select("user_email, created_at, status")
      .gte("created_at", since),
    sb
      .from("agent_proposals")
      .select("status")
      .eq("source", "voice")
      .in("status", ["approved", "edited_and_approved", "rejected"]),
    sb
      .from("agent_proposals")
      .select("status")
      .eq("proposal_type", "enrichment")
      .in("status", ["approved", "edited_and_approved", "rejected"])
  ]);

  const statusCounts: StatusCounts = { extracted: 0, submitted: 0, discarded: 0, failed: 0 };
  for (const row of (allSessions.data ?? []) as { status: keyof StatusCounts }[]) {
    if (row.status in statusCounts) statusCounts[row.status]++;
  }

  const uniqueRecentUsers = new Set(
    ((recentSessions.data ?? []) as { user_email: string }[]).map((r) => r.user_email.toLowerCase())
  );
  const totalRecent = recentSessions.data?.length ?? 0;

  const voiceApprovalRate = ratio(
    (voiceProposals.data ?? []).filter((p) => approvedStatus(p.status)).length,
    voiceProposals.data?.length ?? 0
  );
  const overallApprovalRate = ratio(
    (allEnrichmentProposals.data ?? []).filter((p) => approvedStatus(p.status)).length,
    allEnrichmentProposals.data?.length ?? 0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-page font-medium text-text-primary">Voice stats</h1>
        <p className="mt-1 text-body text-text-secondary">
          V2.5 PoC success metrics. First-two-week bar: ≥10 submitted · ≥70% approval rate · ≥2
          distinct users.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-section font-serif text-text-primary">Sessions by status</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Extracted" value={statusCounts.extracted} />
          <Stat label="Submitted" value={statusCounts.submitted} />
          <Stat label="Discarded" value={statusCounts.discarded} />
          <Stat label="Failed" value={statusCounts.failed} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-section font-serif text-text-primary">Last 14 days</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Sessions" value={totalRecent} />
          <Stat label="Distinct users" value={uniqueRecentUsers.size} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-section font-serif text-text-primary">Approval rate</h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Voice proposals"
            value={voiceApprovalRate.label}
            sub={`${voiceApprovalRate.numerator}/${voiceApprovalRate.denominator}`}
          />
          <Stat
            label="All enrichment proposals"
            value={overallApprovalRate.label}
            sub={`${overallApprovalRate.numerator}/${overallApprovalRate.denominator}`}
          />
        </div>
      </section>
    </div>
  );
}

function approvedStatus(s: unknown): boolean {
  return s === "approved" || s === "edited_and_approved";
}

function ratio(numerator: number, denominator: number) {
  const label =
    denominator === 0 ? "—" : `${Math.round((numerator / denominator) * 100)}%`;
  return { numerator, denominator, label };
}

function Stat({
  label,
  value,
  sub
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface px-4 py-3">
      <div className="text-label uppercase tracking-[0.04em] text-text-tertiary">{label}</div>
      <div className="mt-1 font-serif text-[28px] font-medium text-text-primary">{value}</div>
      {sub && <div className="mt-0.5 text-label text-text-tertiary">{sub}</div>}
    </div>
  );
}
