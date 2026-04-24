import { createHash } from "node:crypto";

export function rowHash(normalizedRow: Record<string, unknown>): string {
  // Stable key order for determinism across syncs.
  const ordered: Record<string, unknown> = {};
  for (const k of Object.keys(normalizedRow).sort()) {
    ordered[k] = normalizedRow[k];
  }
  return createHash("sha256").update(JSON.stringify(ordered)).digest("hex");
}
