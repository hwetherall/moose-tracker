import type { NormalizationWarning, PlanningItem } from "@/lib/types";
import { normalizePlanningStatus } from "./status";
import { resolveOwners, type AliasMap } from "./owners";
import { parseLinks, parseExperimentRefs } from "./links";
import { asText, parseSheetBool, parseSheetDate, parseSheetInt } from "./dates";
import { rowHash } from "./hash";

/**
 * Turn a raw Planning sheet row (array indexed by column) into a PlanningItem.
 * Returns null for rows without a name (empty trailing rows).
 * `sheetRow` is 1-indexed — the row number in the sheet, used for deep links.
 */
export function normalizePlanningRow(
  row: unknown[],
  sheetRow: number,
  aliases: AliasMap,
  warnings: NormalizationWarning[]
): PlanningItem | null {
  const name = asText(row[1]); // col 2
  if (!name) return null;

  const id = parseSheetInt(row[0]); // col 1
  if (id === null) {
    warnings.push({
      kind: "other",
      message: `Skipping row ${sheetRow}: name "${name}" has no numeric id in col 1`,
      context: { sheetRow, name }
    });
    return null;
  }

  const statusRaw = asText(row[4]) ?? "";
  const status = normalizePlanningStatus(statusRaw, warnings);

  const rRaw = asText(row[15]);
  const aRaw = asText(row[16]);
  const dRaw = asText(row[17]);

  const partial = {
    id,
    sheetRow,
    name,
    release: asText(row[2]),
    seq: asText(row[3]),
    status,
    statusRaw,
    type: asText(row[5]),
    category: asText(row[6]),
    subsystem: asText(row[7]),
    parentEpic: asText(row[8]),
    parentEpicId: null as number | null,
    links: parseLinks(asText(row[9])),
    rankScore: parseSheetInt(row[10]),
    priority: parseSheetInt(row[11]),
    impact: parseSheetInt(row[12]),
    difficulty: parseSheetInt(row[14]),
    experimentsRefs: parseExperimentRefs(asText(row[13])),
    rEmails: resolveOwners(rRaw, aliases, warnings),
    aEmails: resolveOwners(aRaw, aliases, warnings),
    dEmails: resolveOwners(dRaw, aliases, warnings),
    rRaw,
    aRaw,
    dRaw,
    dueDate: parseSheetDate(row[18]),
    comments: asText(row[19]),
    dod: asText(row[20]),
    blocker: asText(row[21]),
    blockedSince: parseSheetDate(row[22]),
    isReady: parseSheetBool(row[23])
  };

  return { ...partial, rowHash: rowHash(partial) };
}
