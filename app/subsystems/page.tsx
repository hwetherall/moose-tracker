import Link from "next/link";
import { fetchPlanningItems } from "@/lib/queries/planning";
import { filtersToQuery } from "@/lib/queries/filters";

const COLUMNS: { label: string; statuses: string[] }[] = [
  { label: "InDev", statuses: ["1-InDev", "1-InDevPrompt"] },
  { label: "ReadyForDev", statuses: ["2-ReadyForDev"] },
  { label: "Discovery", statuses: ["3-Discovery", "3-Design"] },
  { label: "Blocked", statuses: ["0-Blocked"] },
  { label: "Backlog", statuses: ["5-Backlog", "0-?"] },
  { label: "Done", statuses: ["0-Done"] }
];

export default async function SubsystemsPage() {
  const items = await fetchPlanningItems({});
  const names = Array.from(new Set(items.map((i) => i.subsystem ?? "Unassigned"))).sort();

  const countFor = (sub: string, cols: string[]) =>
    items.filter((i) => (i.subsystem ?? "Unassigned") === sub && cols.includes(i.status)).length;

  return (
    <div>
      <div className="mb-3">
        <h2 className="font-serif text-section text-text-primary">By Subsystem</h2>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-bg-surface">
        <table className="w-full text-body">
          <thead className="bg-bg-muted text-left text-label uppercase tracking-[0.04em] text-text-tertiary">
            <tr>
              <th className="px-3 py-2 font-normal">Subsystem</th>
              {COLUMNS.map((c) => (
                <th key={c.label} className="px-3 py-2 text-right font-normal">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {names.map((sub) => (
              <tr key={sub} className="hover:bg-bg-muted">
                <td className="px-3 py-2 text-text-primary">{sub}</td>
                {COLUMNS.map((c) => {
                  const count = countFor(sub, c.statuses);
                  const href = `/items${filtersToQuery({ subsystem: [sub === "Unassigned" ? "" : sub], status: c.statuses })}`;
                  return (
                    <td key={c.label} className="px-3 py-2 text-right text-body tabular-nums">
                      {count === 0 ? (
                        <span className="text-text-tertiary">—</span>
                      ) : (
                        <Link href={href} className="text-text-primary hover:text-brand hover:underline">
                          {count}
                        </Link>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
