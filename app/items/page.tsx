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
        <h2 className="font-serif text-section text-text-primary">Items</h2>
        <div className="text-label text-text-tertiary">{items.length} shown</div>
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
        <div className="rounded-md border border-dashed border-border-subtle bg-bg-muted p-8 text-center text-body text-text-tertiary">
          No items match these filters.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <ItemCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}
