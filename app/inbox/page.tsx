import Link from "next/link";
import { fetchAllPendingProposals } from "@/lib/queries/agent";
import { fetchPlanningItems } from "@/lib/queries/planning";
import { ProposalCard } from "@/components/agent/ProposalCard";
import { InboxBulkActions } from "@/components/agent/InboxBulkActions";
import type { ProposalRow } from "@/lib/agent/types";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [proposals, items] = await Promise.all([fetchAllPendingProposals(), fetchPlanningItems({})]);
  const itemsById = new Map(items.map((i) => [i.id, i]));

  if (proposals.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="mx-auto max-w-md py-16 text-center text-compact text-text-tertiary">
          No proposals to review. The agent will surface new ones as it finds them.
        </div>
      </div>
    );
  }

  const grouped = groupByItem(proposals);

  return (
    <div className="space-y-6">
      <Header count={proposals.length} />
      <div className="space-y-6">
        {grouped.map(({ itemId, proposals: ps }) => {
          const item = itemsById.get(itemId);
          return (
            <section
              key={itemId}
              className="rounded-lg border border-border-subtle bg-bg-surface p-4"
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <Link
                  href={`/item/${itemId}`}
                  prefetch={false}
                  className="flex min-w-0 items-baseline gap-2"
                >
                  <span className="font-mono text-label text-text-tertiary">#{itemId}</span>
                  <span className="truncate font-serif text-[15px] font-medium text-text-primary">
                    {item?.name ?? `Item ${itemId}`}
                  </span>
                </Link>
                <InboxBulkActions itemId={itemId} proposals={ps} />
              </header>
              <div className="space-y-2">
                {ps.map((p) => (
                  <ProposalCard key={p.id} proposal={p} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Header({ count }: { count?: number }) {
  return (
    <div>
      <h1 className="font-serif text-page font-medium text-text-primary">Inbox</h1>
      <p className="mt-1 text-body text-text-secondary">
        {count
          ? `${count} pending proposal${count === 1 ? "" : "s"} from the agent. Approve, edit, or reject.`
          : "Pending proposals from the agent. Approve, edit, or reject."}
      </p>
    </div>
  );
}

function groupByItem(proposals: ProposalRow[]): { itemId: number; proposals: ProposalRow[] }[] {
  const map = new Map<number, ProposalRow[]>();
  for (const p of proposals) {
    if (!map.has(p.item_id)) map.set(p.item_id, []);
    map.get(p.item_id)!.push(p);
  }
  return Array.from(map.entries())
    .map(([itemId, proposals]) => ({ itemId, proposals }))
    .sort((a, b) => b.proposals.length - a.proposals.length);
}
