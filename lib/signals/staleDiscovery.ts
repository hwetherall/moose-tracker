import type { SignalCheck } from "./types";

const DAYS = 30;

/**
 * Fires when items have been in `3-Discovery` for more than 30 days.
 *
 * Uses the most recent status_changes entry where to_status = '3-Discovery'
 * to estimate when the item entered the state. On day-0 of V1.5 deployment
 * this table is empty, so the signal returns nothing — by design (§1.3).
 */
export const staleDiscovery: SignalCheck = ({ items, statusEntries, today }) => {
  const enteredDiscoveryAt = new Map<number, Date>();
  for (const e of statusEntries) {
    if (e.to_status !== "3-Discovery") continue;
    const t = new Date(e.changed_at);
    const cur = enteredDiscoveryAt.get(e.item_id);
    if (!cur || t > cur) enteredDiscoveryAt.set(e.item_id, t);
  }

  const stale: number[] = [];
  for (const item of items) {
    if (item.status !== "3-Discovery") continue;
    const enteredAt = enteredDiscoveryAt.get(item.id);
    if (!enteredAt) continue;
    const days = (today.getTime() - enteredAt.getTime()) / 86_400_000;
    if (days > DAYS) stale.push(item.id);
  }

  if (stale.length === 0) return [];
  return [
    {
      id: "stale-discovery",
      severity: "observation",
      title: "Stale Discovery",
      body: `${stale.length} ${stale.length === 1 ? "item has" : "items have"} been in Discovery over ${DAYS} days. They may be stuck behind a decision.`,
      affectedItemIds: stale,
      actionLabel: `View ${stale.length} ${stale.length === 1 ? "item" : "items"}`,
      actionHref: "/items?status=3-Discovery"
    }
  ];
};
