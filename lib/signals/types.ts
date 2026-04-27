import type { Row } from "@/lib/queries/planning";
import type { ReleaseRow } from "@/lib/queries/releases";

export type SignalSeverity = "warning" | "observation" | "info";

export type Signal = {
  id: string;
  severity: SignalSeverity;
  title: string;
  body: string;
  affectedItemIds: number[];
  actionLabel?: string;
  actionHref?: string;
};

export type Person = {
  email: string;
  display_name: string;
};

export type StatusEntry = {
  item_id: number;
  to_status: string;
  changed_at: string;
};

export type SignalContext = {
  items: Row[];
  people: Person[];
  releases: ReleaseRow[];
  /** Most recent entry per (item_id, to_status). Empty on day-0. */
  statusEntries: StatusEntry[];
  today: Date;
};

export type SignalCheck = (ctx: SignalContext) => Signal[];

export const ACTIVE_STATUSES = [
  "1-InDev",
  "1-InDevPrompt",
  "2-ReadyForDev",
  "3-Discovery",
  "3-Design",
  "4-Experiment"
] as const;
