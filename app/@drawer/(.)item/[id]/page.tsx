import { notFound } from "next/navigation";
import { fetchItemBundle } from "@/lib/queries/itemRelations";
import { ItemDetail } from "@/components/items/ItemDetail";
import { DrawerShell } from "@/components/drawer/DrawerShell";

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

  return (
    <DrawerShell>
      <ItemDetail row={row} parent={parent} children={children} experiments={experiments} />
    </DrawerShell>
  );
}
