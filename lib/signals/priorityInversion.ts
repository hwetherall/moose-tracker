import type { SignalCheck } from "./types";
import { seqValue } from "@/lib/seq";

const HASH_REF = /#(\d+)/g;

// Percentile cutoff over a sorted ascending array. Returns +Infinity for empty
// input so callers gracefully no-op (nothing is "in the top quartile").
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return Number.POSITIVE_INFINITY;
  const idx = Math.min(Math.floor(sortedAsc.length * p), sortedAsc.length - 1);
  return sortedAsc[idx];
}

/**
 * Fires when a top-quartile item (by Seq) has a blocker text referencing an
 * item that is itself bottom-quartile (by Seq) or in Backlog.
 *
 * Cutoffs are derived from the active snapshot's Seq distribution rather than
 * fixed magic numbers, so this stays sensible as the queue grows.
 */
export const priorityInversion: SignalCheck = ({ items }) => {
  const byId = new Map(items.map((i) => [i.id, i]));
  const findings: ReturnType<SignalCheck> = [];

  const seqs = items
    .map((i) => seqValue(i.seq))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const highCutoff = percentile(seqs, 0.25);
  const lowCutoff = percentile(seqs, 0.75);

  for (const item of items) {
    const itemSeq = seqValue(item.seq);
    if (!Number.isFinite(itemSeq) || itemSeq > highCutoff) continue;
    if (!item.blocker) continue;

    const refs = Array.from(item.blocker.matchAll(HASH_REF))
      .map((m) => Number(m[1]))
      .filter((n) => Number.isFinite(n) && byId.has(n));

    for (const refId of refs) {
      const dep = byId.get(refId);
      if (!dep) continue;
      const depSeq = seqValue(dep.seq);
      const isLowSeq = Number.isFinite(depSeq) && depSeq >= lowCutoff;
      const isBacklog = dep.status === "5-Backlog";
      if (!isLowSeq && !isBacklog) continue;

      const condition = isBacklog ? "is in Backlog" : `has Seq ${dep.seq}`;
      findings.push({
        id: `priority-inversion:${item.id}->${refId}`,
        severity: "warning",
        title: "Priority inversion",
        body: `#${item.id} (Seq ${item.seq}) is blocked by #${refId} which ${condition}. Promote the blocker, or accept the slip.`,
        affectedItemIds: [item.id, refId],
        actionLabel: "Open item",
        actionHref: `/item/${item.id}`
      });
    }
  }
  return findings;
};
