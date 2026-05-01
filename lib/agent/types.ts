import type { Row } from "@/lib/queries/planning";
import type { ReleaseRow } from "@/lib/queries/releases";
import type { Signal } from "@/lib/signals";

export type Person = { email: string; display_name: string };

export type StatusChange = {
  id: number;
  item_id: number;
  from_status: string | null;
  to_status: string;
  changed_at: string;
};

export type BlockedEpisode = {
  id: number;
  item_id: number;
  started_at: string;
  ended_at: string | null;
  blocker_text: string | null;
  resolved_to_status: string | null;
};

export type ItemEnrichmentRow = {
  item_id: number;
  brief: string | null;
  brief_approved_by: string | null;
  brief_approved_at: string | null;
  brief_synced_to_sheet: boolean;
  acceptance_criteria: { text: string; done: boolean }[];
  acceptance_criteria_approved_at: string | null;
  effort_estimate: "XS" | "S" | "M" | "L" | "XL" | null;
  effort_approved_at: string | null;
  risk_level: "low" | "medium" | "high" | null;
  risk_rationale: string | null;
  risk_approved_at: string | null;
  related_item_ids: number[];
  related_approved_at: string | null;
  updated_at: string;
};

export type AgentContext = {
  items: Row[];
  enrichments: Map<number, ItemEnrichmentRow>;
  signals: Signal[];
  statusChanges: StatusChange[];
  blockedEpisodes: BlockedEpisode[];
  people: Person[];
  releases: ReleaseRow[];
  today: Date;
};

export type ProposalType = "enrichment" | "inspector_fix";

export type ProposalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "edited_and_approved"
  | "superseded";

// Known proposal sources. `inspector:<check_id>` is also a valid source pattern
// (see `agent_proposals.source` comment in 0003_v2.sql), so consumers should
// treat `source` as a string and only narrow when matching specific origins.
export type ProposalSource = "enrichment" | "voice" | string;

export type ProposalRow = {
  id: number;
  proposal_type: ProposalType;
  item_id: number;
  field: string;
  current_value: unknown;
  proposed_value: unknown;
  rationale: string | null;
  source: ProposalSource;
  source_session_id: number | null;
  generated_at: string;
  generated_by_model: string | null;
  status: ProposalStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_value: unknown;
};

export type VoiceSessionStatus = "extracted" | "submitted" | "discarded" | "failed";

export type VoiceSessionRow = {
  id: number;
  item_id: number;
  user_email: string;
  transcript: string;
  transcript_model: string;
  extraction_model: string | null;
  extracted_brief: string | null;
  extracted_ac: { text: string }[] | null;
  duration_seconds: number | null;
  status: VoiceSessionStatus;
  failure_reason: string | null;
  created_at: string;
  expires_at: string;
};

export type FindingRow = {
  id: number;
  check_id: string;
  item_id: number;
  severity: "warning" | "observation";
  title: string;
  detail: string;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
};
