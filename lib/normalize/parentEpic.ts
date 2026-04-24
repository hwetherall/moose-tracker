import type { NormalizationWarning, PlanningItem } from "@/lib/types";

/**
 * Resolve `parent_epic` (freetext) to an Epic row's id via case-insensitive
 * substring match. Ambiguous or missing matches return null.
 *
 * Pass 1 collects epic candidates; pass 2 resolves. Call after all rows are built.
 */
export function resolveParentEpics(
  rows: PlanningItem[],
  warnings: NormalizationWarning[]
): PlanningItem[] {
  const epics = rows.filter((r) => r.type?.toLowerCase() === "epic");
  return rows.map((row) => {
    if (!row.parentEpic) return row;
    const needle = row.parentEpic.toLowerCase();
    const matches = epics.filter((e) => e.name.toLowerCase().includes(needle) || needle.includes(e.name.toLowerCase()));
    if (matches.length === 1) {
      return { ...row, parentEpicId: matches[0].id };
    }
    warnings.push({
      kind: "unresolved_parent_epic",
      message:
        matches.length === 0
          ? `No Epic matched parent text "${row.parentEpic}"`
          : `Ambiguous Epic match (${matches.length}) for "${row.parentEpic}"`,
      context: { itemId: row.id, parentEpic: row.parentEpic, matchCount: matches.length }
    });
    return row;
  });
}
