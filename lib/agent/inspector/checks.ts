import { differenceInCalendarDays } from "date-fns";
import type { Row } from "@/lib/queries/planning";
import type { AgentContext } from "../types";
import type { InspectorCheck, InspectorFinding } from "./types";

const ACTIVE_STATUSES = new Set([
  "1-InDev",
  "1-InDevPrompt",
  "2-ReadyForDev",
  "3-Discovery",
  "3-Design",
  "4-Experiment"
]);

const KNOWN_STATUSES = new Set([
  "0-Done",
  "0-Blocked",
  "0-?",
  "1-InDev",
  "1-InDevPrompt",
  "2-ReadyForDev",
  "3-Discovery",
  "3-Design",
  "4-Experiment",
  "5-Backlog"
]);

const f = (
  check_id: string,
  severity: "warning" | "observation",
  item_id: number,
  title: string,
  detail: string,
  suggested_fix?: InspectorFinding["suggested_fix"]
): InspectorFinding => ({
  check_id,
  severity,
  item_id,
  title,
  detail,
  suggested_fix
});

// 1. Status / parent mismatch — child Done but parent epic isn't.
export const statusParentMismatch: InspectorCheck = (ctx) => {
  const out: InspectorFinding[] = [];
  for (const item of ctx.items) {
    if (item.status !== "0-Done") continue;
    if (item.parent_epic_id == null) continue;
    const parent = ctx.items.find((i) => i.id === item.parent_epic_id);
    if (!parent) continue;
    if (parent.status === "0-Done") continue;
    out.push(
      f(
        "status-parent-mismatch",
        "warning",
        item.id,
        "Done child of a not-Done epic",
        `Item is Done but its parent epic #${parent.id} is in ${parent.status}.`
      )
    );
  }
  return out;
};

// 2. Orphan epic — type=Epic with no child references.
export const orphanEpic: InspectorCheck = (ctx) => {
  const out: InspectorFinding[] = [];
  const referenced = new Set<number>();
  for (const i of ctx.items) {
    if (i.parent_epic_id != null) referenced.add(i.parent_epic_id);
  }
  for (const item of ctx.items) {
    if (item.type !== "Epic") continue;
    if (referenced.has(item.id)) continue;
    out.push(
      f(
        "orphan-epic",
        "observation",
        item.id,
        "Orphan epic",
        "No items reference this epic via parent_epic_id."
      )
    );
  }
  return out;
};

// 3. Unknown status value — status_raw doesn't normalize to canonical.
export const unknownStatus: InspectorCheck = (ctx) => {
  const out: InspectorFinding[] = [];
  for (const item of ctx.items) {
    if (KNOWN_STATUSES.has(item.status)) continue;
    out.push(
      f(
        "unknown-status",
        "warning",
        item.id,
        "Unknown status",
        `Status "${item.status_raw}" did not normalize to a known status.`
      )
    );
  }
  return out;
};

// 4. Unknown owner — raw R/A/D contains a name not in the alias map.
export const unknownOwner: InspectorCheck = (ctx) => {
  const out: InspectorFinding[] = [];
  for (const item of ctx.items) {
    const allRaw = [item.r_raw, item.a_raw, item.d_raw].filter(Boolean) as string[];
    const allEmails = [...item.r_emails, ...item.a_emails, ...item.d_emails];
    const rawNames = allRaw
      .flatMap((r) => r.split(/[/,;]/))
      .map((s) => s.trim())
      .filter(Boolean);
    if (rawNames.length === 0) continue;
    if (rawNames.length > allEmails.length) {
      out.push(
        f(
          "unknown-owner",
          "warning",
          item.id,
          "Unrecognised owner name",
          `Owner field has ${rawNames.length} name(s) but only ${allEmails.length} resolved to a person.`
        )
      );
    }
  }
  return out;
};

// 5. Malformed Jira link.
export const malformedJiraLink: InspectorCheck = (ctx) => {
  const out: InspectorFinding[] = [];
  const re = /^(PRMT|INV)-/i;
  for (const item of ctx.items) {
    for (const l of item.links) {
      if (!re.test(l.id)) continue;
      const malformed =
        /\s/.test(l.id) || /[a-z]/.test(l.id) || /[.,;:]$/.test(l.id);
      if (!malformed) continue;
      out.push(
        f(
          "malformed-jira-link",
          "observation",
          item.id,
          "Malformed Jira link",
          `Jira reference "${l.raw}" has whitespace, lowercase, or trailing punctuation.`
        )
      );
      break;
    }
  }
  return out;
};

// 6. Rank score arithmetic — rank_score != P*100 + I*10 + D when all three set.
export const rankScoreArithmetic: InspectorCheck = (ctx) => {
  const out: InspectorFinding[] = [];
  for (const item of ctx.items) {
    if (
      item.priority == null ||
      item.impact == null ||
      item.difficulty == null ||
      item.rank_score == null
    ) {
      continue;
    }
    const expected = item.priority * 100 + item.impact * 10 + item.difficulty;
    if (item.rank_score === expected) continue;
    out.push(
      f(
        "rank-score-arithmetic",
        "warning",
        item.id,
        "Rank score doesn't match P/I/D",
        `Rank ${item.rank_score} but P*100+I*10+D = ${expected}.`
      )
    );
  }
  return out;
};

// 7. Blocked without blocker text.
export const blockedWithoutBlocker: InspectorCheck = (ctx) => {
  const out: InspectorFinding[] = [];
  for (const item of ctx.items) {
    if (item.status !== "0-Blocked") continue;
    if (item.blocker && item.blocker.trim().length > 0) continue;
    out.push(
      f(
        "blocked-without-blocker",
        "warning",
        item.id,
        "Blocked without a blocker note",
        "Status is Blocked but blocker text is empty. Add what's blocking."
      )
    );
  }
  return out;
};

// 8. Blocker text without Blocked status.
export const blockerWithoutBlocked: InspectorCheck = (ctx) => {
  const out: InspectorFinding[] = [];
  for (const item of ctx.items) {
    if (!item.blocker || item.blocker.trim().length === 0) continue;
    if (item.status === "0-Blocked") continue;
    out.push(
      f(
        "blocker-without-blocked",
        "observation",
        item.id,
        "Blocker text but not Blocked",
        `Blocker note exists but status is ${item.status}.`,
        {
          field: "blocker",
          current_value: item.blocker,
          proposed_value: null,
          rationale: "Clear stale blocker note since the item isn't blocked."
        }
      )
    );
  }
  return out;
};

// 9. blocked_since without Blocked + no blocker text.
export const blockedSinceWithoutBlocked: InspectorCheck = (ctx) => {
  const out: InspectorFinding[] = [];
  for (const item of ctx.items) {
    if (!item.blocked_since) continue;
    if (item.status === "0-Blocked") continue;
    if (item.blocker && item.blocker.trim().length > 0) continue;
    out.push(
      f(
        "blocked-since-without-blocked",
        "observation",
        item.id,
        "blocked_since set but not blocked",
        `blocked_since is ${item.blocked_since} but status is ${item.status} with no blocker.`,
        {
          field: "blocked_since",
          current_value: item.blocked_since,
          proposed_value: null,
          rationale: "Clear blocked_since since the item is no longer blocked."
        }
      )
    );
  }
  return out;
};

// 10. InDev without DoD AND no acceptance_criteria.
export const inDevWithoutDoD = (
  acceptanceCriteriaByItem: Map<number, { text: string; done: boolean }[]>
): InspectorCheck => (ctx) => {
  const out: InspectorFinding[] = [];
  for (const item of ctx.items) {
    if (item.status !== "1-InDev" && item.status !== "1-InDevPrompt") continue;
    const dodEmpty = !item.dod || item.dod.trim().length === 0;
    const ac = acceptanceCriteriaByItem.get(item.id) ?? [];
    if (!dodEmpty || ac.length > 0) continue;
    out.push(
      f(
        "indev-without-dod",
        "observation",
        item.id,
        "InDev without Definition of Done",
        "No DoD and no acceptance criteria. This will be hard to land cleanly."
      )
    );
  }
  return out;
};

// 11. Future blocked-since.
export const futureBlockedSince: InspectorCheck = (ctx) => {
  const out: InspectorFinding[] = [];
  for (const item of ctx.items) {
    if (!item.blocked_since) continue;
    const since = new Date(item.blocked_since);
    if (Number.isNaN(since.getTime())) continue;
    if (since.getTime() <= ctx.today.getTime()) continue;
    out.push(
      f(
        "future-blocked-since",
        "warning",
        item.id,
        "blocked_since is in the future",
        `blocked_since=${item.blocked_since} is after today.`
      )
    );
  }
  return out;
};

// 12. Done with future due_date.
export const doneWithFutureDue: InspectorCheck = (ctx) => {
  const out: InspectorFinding[] = [];
  for (const item of ctx.items) {
    if (item.status !== "0-Done") continue;
    if (!item.due_date) continue;
    const due = new Date(item.due_date);
    if (Number.isNaN(due.getTime())) continue;
    if (due.getTime() <= ctx.today.getTime()) continue;
    out.push(
      f(
        "done-with-future-due",
        "observation",
        item.id,
        "Done but due date is in the future",
        `Item is Done but due_date=${item.due_date} hasn't arrived yet. Was this finished early?`,
        {
          field: "due_date",
          current_value: item.due_date,
          proposed_value: null,
          rationale: "Clear due_date since the item is already Done."
        }
      )
    );
  }
  return out;
};

// 13. Status churn — 4+ status transitions in last 7 days.
export const statusChurn: InspectorCheck = (ctx) => {
  const out: InspectorFinding[] = [];
  const cutoff = new Date(ctx.today.getTime() - 7 * 86_400_000);
  const counts = new Map<number, number>();
  for (const c of ctx.statusChanges) {
    if (new Date(c.changed_at) < cutoff) continue;
    counts.set(c.item_id, (counts.get(c.item_id) ?? 0) + 1);
  }
  for (const [itemId, count] of counts) {
    if (count < 4) continue;
    const item = ctx.items.find((i) => i.id === itemId);
    if (!item) continue;
    out.push(
      f(
        "status-churn",
        "observation",
        itemId,
        "Status churn",
        `${count} status transitions in the last 7 days. Something is unstable.`
      )
    );
  }
  return out;
};

// Used by the runner — utility unused inside individual checks but useful for callers.
export function isActive(item: Row): boolean {
  return ACTIVE_STATUSES.has(item.status);
}

export function daysAgo(d: string | null, today: Date): number | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return differenceInCalendarDays(today, date);
}
