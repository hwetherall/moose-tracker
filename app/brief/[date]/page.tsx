import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { fetchBriefByDate, fetchRecentBriefs } from "@/lib/queries/agent";
import { BriefCard } from "@/components/agent/BriefCard";

export const dynamic = "force-dynamic";

export default async function BriefByDatePage({
  params
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const [brief, recent] = await Promise.all([fetchBriefByDate(date), fetchRecentBriefs(30)]);
  if (!brief) notFound();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-label text-text-secondary hover:text-text-primary"
        >
          <ChevronLeft className="h-3 w-3" />
          Back to Overview
        </Link>
        <h1 className="font-serif text-page font-medium text-text-primary">Brief — {brief.brief_date}</h1>
      </header>

      {brief.error ? (
        <div className="rounded-md border border-border-subtle bg-status-blocked-soft p-4 text-compact text-status-blocked-text">
          Brief generation failed for this date: {brief.error}
        </div>
      ) : (
        <BriefCard
          briefId={brief.id}
          briefDate={brief.brief_date}
          bodyHtml={brief.body_html}
          generatedAt={brief.generated_at}
        />
      )}

      <section className="rounded-md border border-border-subtle bg-bg-surface p-4">
        <h2 className="mb-3 text-badge uppercase tracking-[0.04em] text-text-tertiary">Recent briefs</h2>
        <ul className="space-y-1 text-compact">
          {recent.map((r) => (
            <li key={r.id}>
              <Link
                href={`/brief/${r.brief_date}`}
                prefetch={false}
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-bg-muted ${
                  r.brief_date === date ? "bg-bg-muted text-text-primary" : "text-text-secondary"
                }`}
              >
                <span className="font-mono">{r.brief_date}</span>
                <span className="text-text-tertiary">
                  {r.error ? "(failed)" : `${r.body_md.split(/\s+/).length} words`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
