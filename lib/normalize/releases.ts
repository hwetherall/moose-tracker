import type { Release } from "@/lib/types";
import { asText, parseSheetDate } from "./dates";

/**
 * Releases tab layout (inferred): col A = name, then columns for planned/revised/actual
 * staging and prod. Exact header order varies; this accepts the first non-empty,
 * name-bearing rows and maps by index. Adjust mapping when Harry confirms schema.
 */
export function normalizeReleasesRows(rows: unknown[][]): Release[] {
  if (rows.length < 2) return [];
  const body = rows.slice(1);
  return body
    .map((r): Release | null => {
      const name = asText(r[0]);
      if (!name) return null;
      return {
        name,
        plannedStaging: parseSheetDate(r[1]),
        revisedStaging: parseSheetDate(r[2]),
        actualStaging: parseSheetDate(r[3]),
        plannedProd: parseSheetDate(r[4]),
        revisedProd: parseSheetDate(r[5]),
        actualProd: parseSheetDate(r[6])
      };
    })
    .filter((r): r is Release => r !== null);
}
