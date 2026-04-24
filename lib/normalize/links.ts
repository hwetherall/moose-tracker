import type { Link } from "@/lib/types";

const PRMT = /^PRMT-\d+$/i;
const INV = /^INV-\d+$/i;
const GRAPH = /^G\d+(\.\d+)?$/i;

export function parseLinks(raw: string | null | undefined): Link[] {
  if (!raw) return [];
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.map((p) => {
    if (PRMT.test(p)) return { id: p.toUpperCase(), type: "jira_prmt", raw: p };
    if (INV.test(p)) return { id: p.toUpperCase(), type: "jira_inv", raw: p };
    if (GRAPH.test(p)) return { id: p.toUpperCase(), type: "graph", raw: p };
    return { id: p, type: "other", raw: p };
  });
}

export function parseExperimentRefs(raw: string | null | undefined): { raw: string; key: string | null }[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean).map((r) => ({ raw: r, key: null }));
}
