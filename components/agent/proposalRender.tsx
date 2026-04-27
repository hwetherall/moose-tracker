import type { ReactNode } from "react";

export function fieldLabel(field: string): string {
  switch (field) {
    case "brief":
      return "Brief";
    case "acceptance_criteria":
      return "Acceptance criteria";
    case "effort_estimate":
      return "Effort";
    case "risk_level":
      return "Risk";
    case "risk_rationale":
      return "Risk rationale";
    case "related_item_ids":
      return "Related items";
    case "blocker":
      return "Blocker";
    case "blocked_since":
      return "Blocked since";
    case "due_date":
      return "Due date";
    default:
      return field;
  }
}

export function renderProposalValue(field: string, value: unknown): ReactNode {
  if (value == null || value === "") return <span className="italic text-text-tertiary">—</span>;
  if (field === "acceptance_criteria" && Array.isArray(value)) {
    return (
      <ul className="ml-4 list-disc space-y-0.5">
        {value.map((c, i) => {
          const item = c as { text?: unknown };
          const text = typeof item.text === "string" ? item.text : "";
          return <li key={i}>{text}</li>;
        })}
      </ul>
    );
  }
  if (field === "related_item_ids" && Array.isArray(value)) {
    return (
      <span className="font-mono">
        {value.map((id, i) => (
          <span key={id}>
            #{id}
            {i < value.length - 1 ? ", " : ""}
          </span>
        ))}
      </span>
    );
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className="whitespace-pre-wrap">{String(value)}</span>;
  }
  return <pre className="whitespace-pre-wrap font-mono text-label">{JSON.stringify(value, null, 2)}</pre>;
}
