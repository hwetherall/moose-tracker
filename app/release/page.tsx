import { fetchPlanningItems } from "@/lib/queries/planning";
import { fetchReleases, type ReleaseRow } from "@/lib/queries/releases";
import { ItemCard } from "@/components/items/ItemCard";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

const ORDER = ["R14", "R15", "R16.1", "R16.2", "R17", "R18"];

export default async function ReleasePage() {
  const [items, releases] = await Promise.all([fetchPlanningItems({}), fetchReleases()]);
  const byName = new Map(releases.map((r) => [r.name, r]));

  const knownNames = new Set(ORDER);
  const extraNames = Array.from(new Set(items.map((i) => i.release).filter((r): r is string => !!r && !knownNames.has(r))));
  const columnNames = [...ORDER.filter((r) => items.some((i) => i.release === r) || byName.has(r)), ...extraNames, "Unassigned"];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-section text-text-primary">Release</h2>
        <div className="text-label text-text-tertiary">{items.length} items</div>
      </div>
      <div className="grid gap-3 overflow-x-auto scrollbar-thin" style={{ gridTemplateColumns: `repeat(${columnNames.length}, minmax(260px, 1fr))` }}>
        {columnNames.map((name) => {
          const rel = byName.get(name);
          const colItems = items.filter((i) => (name === "Unassigned" ? !i.release : i.release === name));
          const inFlight = colItems.filter((i) => i.status !== "0-Done");
          const done = colItems.filter((i) => i.status === "0-Done");
          const slipped = isSlipped(rel, inFlight.length);
          return (
            <div
              key={name}
              className={cn(
                "min-w-0 rounded-md border bg-bg-muted p-2",
                slipped ? "border-status-blocked-text/40" : "border-border-subtle"
              )}
            >
              <ReleaseHeader name={name} rel={rel} slipped={slipped} count={colItems.length} />
              <div className="space-y-2">
                {inFlight.map((r) => (
                  <ItemCard key={r.id} row={r} compact />
                ))}
                {inFlight.length === 0 && <div className="px-1 py-1 text-label text-text-tertiary">—</div>}
              </div>
              {done.length > 0 && (
                <details className="mt-2 rounded-md bg-bg-surface p-2 text-label text-text-tertiary">
                  <summary className="cursor-pointer">Done ({done.length})</summary>
                  <div className="mt-2 space-y-2">
                    {done.map((r) => (
                      <ItemCard key={r.id} row={r} compact />
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function isSlipped(rel: ReleaseRow | undefined, inFlightCount: number): boolean {
  if (!rel || inFlightCount === 0) return false;
  const planned = rel.planned_prod ? new Date(rel.planned_prod) : null;
  if (!planned) return false;
  return planned.getTime() < Date.now();
}

function ReleaseHeader({
  name,
  rel,
  slipped,
  count
}: {
  name: string;
  rel: ReleaseRow | undefined;
  slipped: boolean;
  count: number;
}) {
  const planned = rel?.planned_prod ?? null;
  const revised = rel?.revised_prod ?? null;
  const actual = rel?.actual_prod ?? null;
  const slipDays =
    planned && revised
      ? Math.round((new Date(revised).getTime() - new Date(planned).getTime()) / 86_400_000)
      : null;
  return (
    <div className="mb-2 px-1">
      <div className="flex items-center gap-2">
        <span className={cn("font-serif text-section", slipped ? "text-status-blocked-text" : "text-text-primary")}>{name}</span>
        <span className="text-label text-text-tertiary">({count})</span>
      </div>
      {(planned || revised || actual) && (
        <div className="mt-0.5 text-label text-text-secondary">
          {planned && <>planned {formatDateShort(planned)}</>}
          {revised && <> → revised {formatDateShort(revised)}</>}
          {actual && <> · shipped {formatDateShort(actual)}</>}
          {slipDays !== null && slipDays !== 0 && (
            <span className={slipDays > 0 ? "text-status-blocked-text" : "text-status-done-text"}>
              {" "}
              ({slipDays > 0 ? "+" : ""}
              {slipDays}d)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
