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
        <h1 className="text-lg font-semibold tracking-tight text-ink">By Subsystem</h1>
      </div>
      <div className="overflow-x-auto rounded-md border border-paper-line bg-paper">
        <table className="w-full text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase tracking-wider text-ink-mute">
            <tr>
              <th className="px-3 py-2 font-medium">Subsystem</th>
              {COLUMNS.map((c) => (
                <th key={c.label} className="px-3 py-2 font-medium text-right">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-line">
            {names.map((sub) => (
              <tr key={sub} className="hover:bg-paper-soft">
                <td className="px-3 py-2 text-ink">{sub}</td>
                {COLUMNS.map((c) => {
                  const count = countFor(sub, c.statuses);
                  const href = `/items${filtersToQuery({ subsystem: [sub === "Unassigned" ? "" : sub], status: c.statuses })}`;
                  return (
                    <td key={c.label} className="px-3 py-2 text-right text-sm">
                      {count === 0 ? (
                        <span className="text-ink-mute">—</span>
                      ) : (
                        <Link href={href} className="text-ink hover:text-brand hover:underline">
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
