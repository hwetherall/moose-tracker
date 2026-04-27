import { z } from "zod";

// ----- Normalized status vocab (Planning). Experiments normalize into this too. -----
export const STATUSES = [
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
] as const;
export type Status = (typeof STATUSES)[number];

export const TYPES = ["Epic", "Story", "Task"] as const;
export type ItemType = (typeof TYPES)[number];

export const LinkKind = z.enum(["jira_prmt", "jira_inv", "graph", "other"]);
export const LinkSchema = z.object({
  id: z.string(),
  type: LinkKind,
  raw: z.string()
});
export type Link = z.infer<typeof LinkSchema>;

export const ExperimentRefSchema = z.object({
  raw: z.string(),
  key: z.string().nullable()
});
export type ExperimentRef = z.infer<typeof ExperimentRefSchema>;

export const PlanningItemSchema = z.object({
  id: z.number().int(),
  sheetRow: z.number().int(),
  name: z.string(),
  release: z.string().nullable(),
  seq: z.string().nullable(),
  status: z.string(), // validated to Status at the boundary; stored as text for drift tolerance
  statusRaw: z.string(),
  type: z.string().nullable(),
  category: z.string().nullable(),
  subsystem: z.string().nullable(),
  parentEpic: z.string().nullable(),
  parentEpicId: z.number().int().nullable(),
  links: z.array(LinkSchema),
  rankScore: z.number().int().nullable(),
  priority: z.number().int().nullable(),
  impact: z.number().int().nullable(),
  difficulty: z.number().int().nullable(),
  experimentsRefs: z.array(ExperimentRefSchema),
  rEmails: z.array(z.string()),
  aEmails: z.array(z.string()),
  dEmails: z.array(z.string()),
  rRaw: z.string().nullable(),
  aRaw: z.string().nullable(),
  dRaw: z.string().nullable(),
  dueDate: z.string().nullable(),        // ISO date
  comments: z.string().nullable(),
  dod: z.string().nullable(),
  blocker: z.string().nullable(),
  blockedSince: z.string().nullable(),   // ISO date
  isReady: z.boolean().nullable(),
  /** V2: column 25 ("AI Brief") on the Planning sheet. Source of truth when set
   *  per the "sheet wins" principle. The agent writes here post-approval. */
  aiBriefFromSheet: z.string().nullable().optional(),
  rowHash: z.string()
});
export type PlanningItem = z.infer<typeof PlanningItemSchema>;

export const ExperimentSchema = z.object({
  key: z.string(),
  sheetRow: z.number().int(),
  problem: z.string().nullable(),
  problemPlanningId: z.number().int().nullable(),
  experiment: z.string().nullable(),
  question: z.string().nullable(),
  scope: z.string().nullable(),
  details: z.string().nullable(),
  status: z.string(),
  statusRaw: z.string().nullable(),
  notes: z.string().nullable()
});
export type Experiment = z.infer<typeof ExperimentSchema>;

export const ReleaseSchema = z.object({
  name: z.string(),
  plannedStaging: z.string().nullable(),
  revisedStaging: z.string().nullable(),
  actualStaging: z.string().nullable(),
  plannedProd: z.string().nullable(),
  revisedProd: z.string().nullable(),
  actualProd: z.string().nullable()
});
export type Release = z.infer<typeof ReleaseSchema>;

export type NormalizationWarning = {
  kind:
    | "unknown_status"
    | "unknown_alias"
    | "unresolved_experiment_ref"
    | "unresolved_parent_epic"
    | "unknown_category"
    | "unknown_subsystem"
    | "duplicate_id"
    | "other";
  message: string;
  context?: Record<string, unknown>;
};

export type SyncResult = {
  planning: PlanningItem[];
  experiments: Experiment[];
  releases: Release[];
  warnings: NormalizationWarning[];
};

// Canonical enum sets (superset of Lists tab).
export const CATEGORIES = [
  "Core Product", "Quality & Reliability", "Performance", "Client Delivery",
  "Compliance & Security", "Self-Serve & Admin", "Fundraising / Strategy",
  "Infra / DevOps", "Research / Exploration", "Strategy", "AI",
  "Delivery", "Product", "Engineering"
] as const;

export const SUBSYSTEMS = [
  "UI", "Chat", "Input", "Generation", "Guts", "Claims", "Language / i18n",
  "Slides", "Portfolio", "Meta-docs", "Prompts", "Delivery", "DevOps",
  "Compliance", "Admin", "SSO", "RBAC", "Speed / Perf", "UX",
  "Artifact Generator", "Proj. Instructions", "SOT", "FBM", "System",
  "Vault", "HITL", "Project Ins.", "Ingestion"
] as const;

export const RELEASES_ORDER = ["R14", "R15", "R16.1", "R16.2", "R17", "R18"] as const;
