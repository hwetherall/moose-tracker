import type { SignalCheck } from "./types";

const DONE = new Set(["0-Done"]);
const RELEASE_ORDER = ["R14", "R15", "R16.1", "R16.2", "R17", "R18"];

/**
 * Fires when the current release has items not Done AND its revised_prod date
 * is in the past. "Current release" is the earliest in RELEASE_ORDER that has
 * any non-done items.
 */
export const releaseRisk: SignalCheck = ({ items, releases, today }) => {
  const current = RELEASE_ORDER.find((r) =>
    items.some((i) => i.release === r && !DONE.has(i.status))
  );
  if (!current) return [];
  const meta = releases.find((r) => r.name === current);
  const due = meta?.revised_prod ?? meta?.planned_prod;
  if (!due) return [];
  const dueDate = new Date(due);
  if (dueDate.getTime() >= today.getTime()) return [];

  const open = items.filter((i) => i.release === current && !DONE.has(i.status));
  if (open.length === 0) return [];

  const dueStr = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return [
    {
      id: `release-risk:${current}`,
      severity: "warning",
      title: "Release risk",
      body: `${current} was due ${dueStr}. ${open.length} ${open.length === 1 ? "item is" : "items are"} not yet Done.`,
      affectedItemIds: open.map((i) => i.id),
      actionLabel: `View ${current}`,
      actionHref: `/release?release=${encodeURIComponent(current)}`
    }
  ];
};
