import { notFound } from "next/navigation";
import { fetchItemBundle } from "@/lib/queries/itemRelations";
import { ItemDetail } from "@/components/items/ItemDetail";

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

  return (
    <div className="max-w-3xl rounded-md border border-paper-line bg-paper">
      <ItemDetail row={row} parent={parent} children={children} experiments={experiments} />
    </div>
  );
}
