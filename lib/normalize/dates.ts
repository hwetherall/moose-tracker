/**
 * Google Sheets returns dates either as serials (UNFORMATTED_VALUE) or as strings
 * (FORMATTED_STRING). Parse both into ISO YYYY-MM-DD. Returns null on empty/unparseable.
 *
 * Sheet serials are days since 1899-12-30 (Lotus/Excel epoch with the 1900 leap bug).
 */
export function parseSheetDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    const epoch = Date.UTC(1899, 11, 30);
    const ms = epoch + v * 86400000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    // ISO-ish
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    // US M/D/YYYY or M/D/YY
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
    if (us) {
      const m = parseInt(us[1], 10);
      const d = parseInt(us[2], 10);
      let y = parseInt(us[3], 10);
      if (y < 100) y = y >= 70 ? 1900 + y : 2000 + y;
      return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }
  return null;
}

export function parseSheetInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

export function parseSheetBool(v: unknown): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toUpperCase();
    if (s === "TRUE" || s === "YES" || s === "Y") return true;
    if (s === "FALSE" || s === "NO" || s === "N") return false;
  }
  return null;
}

export function asText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
