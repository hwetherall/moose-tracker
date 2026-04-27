import { ACTIVE_STATUSES, fetchPlanningItems, fetchFilterOptions } from "@/lib/queries/planning";
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
  const [allItems, opts, people] = await Promise.all([
    fetchPlanningItems(filters),
    fetchFilterOptions(),
    fetchPeople()
  ]);
  const priorityStatuses = new Set<string>(ACTIVE_STATUSES);
  const items = allItems.filter((item) => priorityStatuses.has(item.status));
  const priorityStatusOptions = opts.statuses.filter((status) => priorityStatuses.has(status));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-section text-text-primary">Items</h2>
        <div className="flex items-center gap-3 text-label">
          <span className="text-text-secondary">Ordered by Seq</span>
          <span className="text-text-tertiary">{items.length} shown</span>
        </div>
      </div>
      <FilterBar
        statuses={priorityStatusOptions}
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
          {items.map((r, index) => (
            <div key={r.id} className="flex items-start gap-2">
              <div className="w-7 shrink-0 pt-3.5 text-right font-mono text-[12px] leading-none tabular-nums text-text-tertiary">
                {index + 1}.
              </div>
              <div className="min-w-0 flex-1">
                <ItemCard row={r} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
