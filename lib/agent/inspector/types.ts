import type { AgentContext } from "../types";

export type InspectorSeverity = "warning" | "observation";

export type InspectorFinding = {
  check_id: string;
  severity: InspectorSeverity;
  item_id: number;
  title: string;
  detail: string;
  suggested_fix?: {
    field: string;
    current_value: unknown;
    proposed_value: unknown;
    rationale: string;
  };
};

export type InspectorCheck = (ctx: AgentContext) => InspectorFinding[];
