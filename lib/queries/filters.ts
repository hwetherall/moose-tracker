/**
 * URL filter parser shared across all list/kanban pages.
 * Every page accepts the same params so filter state is bookmarkable.
 */
export type Filters = {
  status?: string[];
  category?: string[];
  subsystem?: string[];
  release?: string[];
  owner?: string[];   // emails
  type?: string[];
  ready?: boolean | null;
  q?: string | null;
};

export function parseFilters(search: Record<string, string | string[] | undefined>): Filters {
  const multi = (v: string | string[] | undefined): string[] | undefined => {
    if (!v) return undefined;
    const arr = Array.isArray(v) ? v : v.split(",");
    const cleaned = arr.map((s) => s.trim()).filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  };
  const one = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const readyVal = one(search.ready);
  return {
    status: multi(search.status),
    category: multi(search.category),
    subsystem: multi(search.subsystem),
    release: multi(search.release),
    owner: multi(search.owner),
    type: multi(search.type),
    ready: readyVal === "true" ? true : readyVal === "false" ? false : null,
    q: one(search.q)?.trim() || null
  };
}

export function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.status?.length) p.set("status", f.status.join(","));
  if (f.category?.length) p.set("category", f.category.join(","));
  if (f.subsystem?.length) p.set("subsystem", f.subsystem.join(","));
  if (f.release?.length) p.set("release", f.release.join(","));
  if (f.owner?.length) p.set("owner", f.owner.join(","));
  if (f.type?.length) p.set("type", f.type.join(","));
  if (f.ready === true) p.set("ready", "true");
  if (f.ready === false) p.set("ready", "false");
  if (f.q) p.set("q", f.q);
  const s = p.toString();
  return s ? `?${s}` : "";
}
