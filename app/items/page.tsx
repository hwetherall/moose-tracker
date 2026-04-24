import { fetchPlanningItems, fetchFilterOptions } from "@/lib/queries/planning";
import { fetchPeople } from "@/lib/queries/releases";
import { parseFilters } from "@/lib/queries/filters";
import { ItemCard } from "@/components/items/ItemCard";
import { FilterBar } from "@/components/items/FilterBar";

export default async function ItemsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [items, opts, people] = await Promise.all([
    fetchPlanningItems(filters),
    fetchFilterOptions(),
    fetchPeople()
  ]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-ink">Items</h1>
        <div className="text-xs text-ink-mute">{items.length} shown</div>
      </div>
      <FilterBar
        statuses={opts.statuses}
        types={opts.types}
        releases={opts.releases}
        categories={opts.categories}
        subsystems={opts.subsystems}
        people={people}
      />
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-paper-line bg-paper-soft p-8 text-center text-sm text-ink-mute">
          No items match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {items.map((r) => (
            <ItemCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}
