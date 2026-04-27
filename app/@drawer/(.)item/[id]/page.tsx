import { notFound } from "next/navigation";
import { fetchItemBundle } from "@/lib/queries/itemRelations";
import { ItemDetail } from "@/components/items/ItemDetail";
import { DrawerShell } from "@/components/drawer/DrawerShell";
import { auth } from "@/lib/auth";
import {
  fetchEnrichment,
  fetchOpenFindingsForItem,
  fetchPendingProposalsForItem,
  fetchUserPreferences
} from "@/lib/queries/agent";

export default async function ItemDrawer({
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
    <DrawerShell>
      <ItemDetail
        row={row}
        parent={parent}
        children={children}
        experiments={experiments}
        enrichment={enrichment}
        pendingProposals={pendingProposals}
        findings={visibleFindings}
      />
    </DrawerShell>
  );
}
