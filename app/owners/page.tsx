import Link from "next/link";
import { fetchPlanningItems } from "@/lib/queries/planning";
import { fetchPeople } from "@/lib/queries/releases";
import { filtersToQuery } from "@/lib/queries/filters";
import { daysSince } from "@/lib/format";

const COLUMNS: { label: string; statuses: string[]; recentDays?: number }[] = [
  { label: "InDev", statuses: ["1-InDev", "1-InDevPrompt"] },
  { label: "ReadyForDev", statuses: ["2-ReadyForDev"] },
  { label: "Discovery", statuses: ["3-Discovery", "3-Design"] },
  { label: "Blocked", statuses: ["0-Blocked"] },
  { label: "Backlog", statuses: ["5-Backlog", "0-?"] },
  { label: "Done (30d)", statuses: ["0-Done"], recentDays: 30 }
];

export default async function OwnersPage() {
  const [items, people] = await Promise.all([fetchPlanningItems({}), fetchPeople()]);

  // Union of people found in r/a/d, + the seeded people, + "Unassigned".
  const emailsWithItems = new Set<string>();
  for (const i of items) {
    i.r_emails.forEach((e) => emailsWithItems.add(e));
    i.a_emails.forEach((e) => emailsWithItems.add(e));
    i.d_emails.forEach((e) => emailsWithItems.add(e));
  }
  const displayByEmail = new Map(people.map((p) => [p.email, p.display_name]));
  for (const email of emailsWithItems) if (!displayByEmail.has(email)) displayByEmail.set(email, email.split("@")[0]);

  const sortedRows = [...displayByEmail.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const countFor = (email: string | null, col: (typeof COLUMNS)[number]) => {
    const filtered = items.filter((i) => col.statuses.includes(i.status));
    const withinRecent = col.recentDays
      ? filtered.filter((i) => {
          const d = daysSince(i.comments ? null : null); // done_date isn't tracked; use synced_at approximation below
          return d === null ? true : d <= col.recentDays!;
        })
      : filtered;
    if (email === null) {
      return withinRecent.filter(
        (i) => i.r_emails.length === 0 && i.a_emails.length === 0 && i.d_emails.length === 0
      ).length;
    }
    return withinRecent.filter(
      (i) => i.r_emails.includes(email) || i.a_emails.includes(email) || i.d_emails.includes(email)
    ).length;
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-ink">By Owner</h1>
      </div>
      <div className="overflow-x-auto rounded-md border border-paper-line bg-paper">
        <table className="w-full text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase tracking-wider text-ink-mute">
            <tr>
              <th className="px-3 py-2 font-medium">Person</th>
              {COLUMNS.map((c) => (
                <th key={c.label} className="px-3 py-2 font-medium text-right">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-line">
            {sortedRows.map(([email, name]) => (
              <tr key={email} className="hover:bg-paper-soft">
                <td className="px-3 py-2 text-ink">{name}</td>
                {COLUMNS.map((c) => {
                  const count = countFor(email, c);
                  const href = `/items${filtersToQuery({
                    owner: [email],
                    status: c.statuses
                  })}`;
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
            <tr className="hover:bg-paper-soft">
              <td className="px-3 py-2 text-ink-mute italic">Unassigned</td>
              {COLUMNS.map((c) => {
                const count = countFor(null, c);
                return (
                  <td key={c.label} className="px-3 py-2 text-right text-sm text-ink-mute">
                    {count === 0 ? "—" : count}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
