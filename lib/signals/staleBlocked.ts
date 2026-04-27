import type { SignalCheck } from "./types";

const BLOCKED_DAYS = 14;

/**
 * Fires when an item has been blocked > 14 days AND its comments field is
 * empty (per §2.1 — comments-non-null is a weak proxy for "recent activity").
 *
 * Reports the worst offender by days-stuck.
 */
export const staleBlocked: SignalCheck = ({ items, today }) => {
  const candidates = items
    .filter((i) => i.blocked_since)
    .map((i) => {
      const since = new Date(i.blocked_since!);
      const days = Math.floor((today.getTime() - since.getTime()) / 86_400_000);
      return { item: i, days };
    })
    .filter(({ item, days }) => days > BLOCKED_DAYS && !item.comments)
    .sort((a, b) => b.days - a.days);

  if (candidates.length === 0) return [];
  const worst = candidates[0];
  const ids = candidates.map((c) => c.item.id);
  const blockerSnippet = worst.item.blocker
    ? ` Last note: ${truncate(worst.item.blocker, 80)}`
    : "";
  return [
    {
      id: "stale-blocked",
      severity: "warning",
      title: "Stale blocked",
      body: `#${worst.item.id} has been blocked ${worst.days} days.${blockerSnippet}`,
      affectedItemIds: ids,
      actionLabel: candidates.length > 1 ? `View ${candidates.length} blocked items` : "Open item",
      actionHref: candidates.length > 1 ? "/blocked" : `/item/${worst.item.id}`
    }
  ];
};

function truncate(s: string, n: number): string {
  if (s.length <= n) return `"${s}"`;
  return `"${s.slice(0, n - 1).trim()}…"`;
}
