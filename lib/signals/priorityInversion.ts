import type { SignalCheck } from "./types";

const HIGH_RANK_CUTOFF = 200;
const LOW_RANK_CUTOFF = 230;
const HASH_REF = /#(\d+)/g;

/**
 * Fires when a high-priority item (rank ≤ 200) has a blocker text
 * referencing an item that is itself low-priority (rank ≥ 230) or in Backlog.
 *
 * Blocker text is freetext, but commonly references items as `#26`. We extract
 * those refs and look them up in the snapshot.
 */
export const priorityInversion: SignalCheck = ({ items }) => {
  const byId = new Map(items.map((i) => [i.id, i]));
  const findings: ReturnType<SignalCheck> = [];

  for (const item of items) {
    if (item.rank_score === null || item.rank_score > HIGH_RANK_CUTOFF) continue;
    if (!item.blocker) continue;

    const refs = Array.from(item.blocker.matchAll(HASH_REF))
      .map((m) => Number(m[1]))
      .filter((n) => Number.isFinite(n) && byId.has(n));

    for (const refId of refs) {
      const dep = byId.get(refId);
      if (!dep) continue;
      const isLowRank = dep.rank_score !== null && dep.rank_score >= LOW_RANK_CUTOFF;
      const isBacklog = dep.status === "5-Backlog";
      if (!isLowRank && !isBacklog) continue;

      const condition = isBacklog ? "is in Backlog" : `is rank ${dep.rank_score}`;
      findings.push({
        id: `priority-inversion:${item.id}->${refId}`,
        severity: "warning",
        title: "Priority inversion",
        body: `#${item.id} (rank ${item.rank_score}) is blocked by #${refId} which ${condition}. Promote the blocker, or accept the slip.`,
        affectedItemIds: [item.id, refId],
        actionLabel: "Open item",
        actionHref: `/item/${item.id}`
      });
    }
  }
  return findings;
};
