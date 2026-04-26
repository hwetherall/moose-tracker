import { fetchPlanningItems } from "@/lib/queries/planning";
import { ItemCard } from "@/components/items/ItemCard";

export default async function BlockedPage() {
  const items = await fetchPlanningItems({});
  const blocked = items
    .filter((i) => i.status === "0-Blocked" || !!i.blocker)
    .sort((a, b) => {
      const da = a.blocked_since ? new Date(a.blocked_since).getTime() : -Infinity;
      const db = b.blocked_since ? new Date(b.blocked_since).getTime() : -Infinity;
      return db - da;
    });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-section text-text-primary">Blocked</h2>
        <div className="text-label text-text-tertiary">{blocked.length} blocked</div>
      </div>

      {blocked.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-subtle bg-bg-muted p-8 text-center text-body text-text-tertiary">
          Nothing blocked right now.
        </div>
      ) : (
        <div className="space-y-3">
          {blocked.map((r) => (
            <ItemCard key={r.id} row={r} quoteBlocker />
          ))}
        </div>
      )}
    </div>
  );
}
