import type { NormalizationWarning } from "@/lib/types";

export type AliasMap = Map<string, string>; // lowercased alias → canonical email

/**
 * Resolve a freetext R/A/D cell into a list of canonical emails.
 * Splits on "/" and ",", trims, normalizes case, looks up in alias map.
 * Unknown names are logged as warnings and dropped from the email list
 * (the raw string is still preserved separately on the row).
 */
export function resolveOwners(
  raw: string | null | undefined,
  aliases: AliasMap,
  warnings: NormalizationWarning[]
): string[] {
  if (!raw) return [];
  const parts = raw
    .split(/[/,]/)
    .map((p) => p.trim())
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const email = aliases.get(part.toLowerCase());
    if (email) {
      if (!seen.has(email)) {
        out.push(email);
        seen.add(email);
      }
    } else {
      console.warn(`Unknown owner alias "${part}" in "${raw}"`);
      warnings.push({
        kind: "unknown_alias",
        message: `Unknown owner alias "${part}" in "${raw}"`,
        context: { raw, alias: part }
      });
    }
  }
  return out;
}
