import Link from "next/link";
import { fetchExperiments } from "@/lib/queries/experiments";
import { supabaseServer } from "@/lib/supabase/server";
import { StatusDot } from "@/components/items/StatusDot";

const COLS: { label: string; statuses: string[] }[] = [
  { label: "Backlog", statuses: ["5-Backlog", "0-?"] },
  { label: "Discovery/Design", statuses: ["3-Discovery", "3-Design"] },
  { label: "ReadyForDev", statuses: ["2-ReadyForDev"] },
  { label: "InDev", statuses: ["1-InDev", "1-InDevPrompt"] },
  { label: "Done", statuses: ["0-Done"] },
  { label: "Blocked", statuses: ["0-Blocked"] }
];

export default async function ExperimentsPage() {
  const exps = await fetchExperiments();
  const sb = supabaseServer();
  const parentIds = Array.from(new Set(exps.map((e) => e.problem_planning_id).filter((x): x is number => x !== null)));
  const parentsRes = parentIds.length
    ? await sb.from("planning_items").select("id, name").in("id", parentIds)
    : { data: [] };
  const parentById = new Map((parentsRes.data ?? []).map((p: { id: number; name: string }) => [p.id, p.name]));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-ink">Experiments</h1>
        <div className="text-xs text-ink-mute">{exps.length} total</div>
      </div>
      <div className="grid gap-3 overflow-x-auto scrollbar-thin" style={{ gridTemplateColumns: `repeat(${COLS.length}, minmax(260px, 1fr))` }}>
        {COLS.map((col) => {
          const cards = exps.filter((e) => col.statuses.includes(e.status));
          return (
            <div key={col.label} className="min-w-0 rounded-md border border-paper-line bg-paper-soft p-2">
              <div className="mb-2 flex items-center gap-2 px-1 text-xs text-ink-mute">
                <StatusDot status={col.statuses[0]} />
                <span className="font-medium text-ink">{col.label}</span>
                <span>({cards.length})</span>
              </div>
              <div className="space-y-2">
                {cards.map((e) => (
                  <div key={e.key} className="rounded-md border border-paper-line bg-paper p-2.5 text-xs">
                    <div className="flex items-center gap-1.5 text-ink-mute">
                      <span className="font-mono">{e.key}</span>
                      <StatusDot status={e.status} />
                    </div>
                    {e.experiment && <div className="mt-1 text-ink line-clamp-3">{e.experiment}</div>}
                    {e.problem && (
                      <div className="mt-1 text-[11px] text-ink-mute">
                        {e.problem_planning_id ? (
                          <Link href={`/item/${e.problem_planning_id}`} prefetch={false} className="hover:underline">
                            → {parentById.get(e.problem_planning_id) ?? e.problem}
                          </Link>
                        ) : (
                          <span>↳ {e.problem}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {cards.length === 0 && <div className="px-1 py-2 text-[11px] text-ink-mute">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
