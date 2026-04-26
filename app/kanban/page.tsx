import { fetchFilterOptions, fetchPlanningItems } from "@/lib/queries/planning";
import { fetchPeople } from "@/lib/queries/releases";
import { parseFilters } from "@/lib/queries/filters";
import { ItemCard } from "@/components/items/ItemCard";
import { FilterBar } from "@/components/items/FilterBar";
import { StatusDot } from "@/components/items/StatusDot";

// Column groupings per spec §6.5
const COLS: { label: string; statuses: string[] }[] = [
  { label: "5-Backlog",       statuses: ["5-Backlog", "0-?"] },
  { label: "3-Discovery/Design", statuses: ["3-Discovery", "3-Design"] },
  { label: "2-ReadyForDev",   statuses: ["2-ReadyForDev"] },
  { label: "1-InDev",         statuses: ["1-InDev", "1-InDevPrompt"] },
  { label: "4-Experiment",    statuses: ["4-Experiment"] },
  { label: "0-Done",          statuses: ["0-Done"] }
];

export default async function KanbanPage({
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

  const blocked = items.filter((i) => i.status === "0-Blocked");
  const nonBlocked = items.filter((i) => i.status !== "0-Blocked");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-section text-text-primary">Kanban</h2>
        <div className="text-label text-text-tertiary">{items.length} items</div>
      </div>
      <FilterBar
        statuses={opts.statuses}
        types={opts.types}
        releases={opts.releases}
        categories={opts.categories}
        subsystems={opts.subsystems}
        people={people}
      />

      {blocked.length > 0 && (
        <details className="mb-4 rounded-md border border-border-subtle bg-status-blocked-soft p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-body text-status-blocked-text">
            <StatusDot status="0-Blocked" />
            {blocked.length} blocked items
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {blocked.map((r) => (
              <ItemCard key={r.id} row={r} compact />
            ))}
          </div>
        </details>
      )}

      <div className="grid gap-3 overflow-x-auto scrollbar-thin" style={{ gridTemplateColumns: "repeat(6, minmax(260px, 1fr))" }}>
        {COLS.map((col) => {
          const cards = nonBlocked.filter((i) => col.statuses.includes(i.status));
          return (
            <div key={col.label} className="min-w-0 rounded-md border border-border-subtle bg-bg-muted p-2">
              <div className="mb-2 flex items-center gap-2 px-1 text-label text-text-tertiary">
                <StatusDot status={col.statuses[0]} />
                <span className="text-text-primary">{col.label}</span>
                <span>({cards.length})</span>
              </div>
              <div className="space-y-2">
                {cards.map((r) => (
                  <ItemCard key={r.id} row={r} compact />
                ))}
                {cards.length === 0 && <div className="px-1 py-2 text-label text-text-tertiary">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
