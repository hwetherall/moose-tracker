import Link from "next/link";
import { fetchPlanningItems } from "@/lib/queries/planning";
import { daysSince, formatDateShort } from "@/lib/format";

export default async function BlockedPage() {
  const items = await fetchPlanningItems({});
  const blocked = items
    .filter((i) => i.status === "0-Blocked" || !!i.blocker)
    .sort((a, b) => {
      const da = a.blocked_since ? new Date(a.blocked_since).getTime() : -Infinity;
      const db = b.blocked_since ? new Date(b.blocked_since).getTime() : -Infinity;
      return da - db;
    });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-ink">Blocked</h1>
        <div className="text-xs text-ink-mute">{blocked.length} blocked</div>
      </div>

      {blocked.length === 0 ? (
        <div className="rounded-md border border-dashed border-paper-line bg-paper-soft p-8 text-center text-sm text-ink-mute">
          Nothing blocked right now.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-paper-line bg-paper">
          <table className="w-full text-sm">
            <thead className="bg-paper-soft text-left text-xs uppercase tracking-wider text-ink-mute">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Blocker</th>
                <th className="px-3 py-2 font-medium">Blocked since</th>
                <th className="px-3 py-2 font-medium">Days</th>
                <th className="px-3 py-2 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-line">
              {blocked.map((r) => (
                <tr key={r.id} className="hover:bg-paper-soft">
                  <td className="px-3 py-2 font-mono text-xs text-ink-mute">#{r.id}</td>
                  <td className="px-3 py-2">
                    <Link href={`/item/${r.id}`} prefetch={false} className="text-ink hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-soft max-w-sm truncate">{r.blocker ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-ink-soft">{formatDateShort(r.blocked_since)}</td>
                  <td className="px-3 py-2 text-xs text-status-blocked">
                    {daysSince(r.blocked_since) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-soft">
                    {r.r_emails.map((e) => e.split("@")[0]).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
