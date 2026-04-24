import type { NormalizationWarning, Status } from "@/lib/types";

const PLANNING_CANONICAL = new Set<Status>([
  "0-Done", "0-Blocked", "0-?",
  "1-InDev", "1-InDevPrompt",
  "2-ReadyForDev",
  "3-Discovery", "3-Design",
  "4-Experiment",
  "5-Backlog"
]);

// Tolerant fallbacks seen in the data that aren't strictly the canonical vocab.
const PLANNING_FALLBACKS: Record<string, Status> = {
  "in progress": "1-InDev",
  "ready": "2-ReadyForDev"
};

export function normalizePlanningStatus(
  raw: string | null | undefined,
  warnings: NormalizationWarning[]
): Status {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    warnings.push({ kind: "unknown_status", message: "Empty Planning status; defaulting to 5-Backlog", context: { raw } });
    return "5-Backlog";
  }
  if (PLANNING_CANONICAL.has(trimmed as Status)) return trimmed as Status;
  const key = trimmed.toLowerCase();
  if (PLANNING_FALLBACKS[key]) {
    warnings.push({
      kind: "unknown_status",
      message: `Non-canonical Planning status "${trimmed}" mapped to ${PLANNING_FALLBACKS[key]}`,
      context: { raw: trimmed }
    });
    return PLANNING_FALLBACKS[key];
  }
  warnings.push({ kind: "unknown_status", message: `Unknown Planning status "${trimmed}" — kept as-is`, context: { raw: trimmed } });
  return trimmed as Status; // we store text; UI tolerates novel values
}

// Experiments tab is dirty. Strip stray quotes and whitespace before mapping.
const EXPERIMENTS_MAP: Record<string, Status> = {
  "done v1": "0-Done",
  "done": "0-Done",
  "done-ish": "0-Done",
  "blocked": "0-Blocked",
  "qa": "1-InDev",
  "ready for dev": "2-ReadyForDev",
  "backlog": "5-Backlog"
};

export function normalizeExperimentStatus(
  raw: string | null | undefined,
  warnings: NormalizationWarning[]
): Status {
  const cleaned = (raw ?? "").trim().replace(/^['"]+|['"]+$/g, "").trim();
  if (!cleaned) {
    warnings.push({ kind: "unknown_status", message: "Empty Experiments status; defaulting to 5-Backlog", context: { raw } });
    return "5-Backlog";
  }
  const mapped = EXPERIMENTS_MAP[cleaned.toLowerCase()];
  if (mapped) return mapped;
  if (PLANNING_CANONICAL.has(cleaned as Status)) return cleaned as Status;
  warnings.push({ kind: "unknown_status", message: `Unknown Experiment status "${raw}" — defaulting to 5-Backlog`, context: { raw } });
  return "5-Backlog";
}
