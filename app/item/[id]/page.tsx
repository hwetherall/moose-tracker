import { notFound } from "next/navigation";
import { fetchItemBundle } from "@/lib/queries/itemRelations";
import { ItemDetail } from "@/components/items/ItemDetail";
import { auth } from "@/lib/auth";
import {
  fetchEnrichment,
  fetchOpenFindingsForItem,
  fetchPendingProposalsForItem,
  fetchUserPreferences
} from "@/lib/queries/agent";

export default async function ItemPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsed = parseInt(id, 10);
  if (!Number.isFinite(parsed)) notFound();
  const { row, parent, children, experiments } = await fetchItemBundle(parsed);
  if (!row) notFound();

  const session = await auth();
  const userEmail = session?.user?.email?.toLowerCase() ?? "";

  const [enrichment, pendingProposals, findings, prefs] = await Promise.all([
    fetchEnrichment(parsed),
    fetchPendingProposalsForItem(parsed),
    fetchOpenFindingsForItem(parsed),
    userEmail ? fetchUserPreferences(userEmail) : Promise.resolve({ suppressed_check_ids: [], suppressed_signal_ids: [] })
  ]);
  const suppressed = new Set(prefs.suppressed_check_ids);
  const visibleFindings = findings.filter((f) => !suppressed.has(f.check_id));

  return (
    <div className="max-w-3xl rounded-md border border-border-subtle bg-bg-surface">
      <ItemDetail
        row={row}
        parent={parent}
        children={children}
        experiments={experiments}
        enrichment={enrichment}
        pendingProposals={pendingProposals}
        findings={visibleFindings}
      />
    </div>
  );
}
