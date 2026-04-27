import type { SignalCheck } from "./types";
import { ACTIVE_STATUSES } from "./types";
import { displayNameForEmail } from "@/lib/people";

/**
 * Fires when a single person owns more than 25% of active items.
 * Counts an owner if they appear as Responsible or Accountable.
 */
export const concentrationRisk: SignalCheck = ({ items }) => {
  const active = items.filter((i) => (ACTIVE_STATUSES as readonly string[]).includes(i.status));
  if (active.length === 0) return [];

  const counts = new Map<string, number[]>();
  for (const item of active) {
    const owners = new Set<string>([...item.r_emails, ...item.a_emails]);
    for (const e of owners) {
      const arr = counts.get(e) ?? [];
      arr.push(item.id);
      counts.set(e, arr);
    }
  }

  const ownerEntries = Array.from(counts.entries());
  if (ownerEntries.length === 0) return [];
  const totalAssignments = ownerEntries.reduce((s, [, arr]) => s + arr.length, 0);
  const teamAvg = totalAssignments / ownerEntries.length;
  const threshold = active.length * 0.25;

  const findings = ownerEntries
    .filter(([, arr]) => arr.length > threshold)
    .sort((a, b) => b[1].length - a[1].length);

  return findings.map(([email, ids]) => {
    const name = displayNameForEmail(email);
    const factor = teamAvg > 0 ? Math.round((ids.length / teamAvg) * 10) / 10 : null;
    const factorPart = factor && factor >= 1.5 ? `, ${factor}× the team average` : "";
    return {
      id: `concentration:${email}`,
      severity: "warning" as const,
      title: "Concentration risk",
      body: `${name} is on ${ids.length} active items${factorPart}. Consider rebalancing.`,
      affectedItemIds: ids,
      actionLabel: `View ${ids.length} items`,
      actionHref: `/items?owner=${encodeURIComponent(email)}`
    };
  });
};
