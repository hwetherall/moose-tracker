"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, Pencil, Loader2 } from "lucide-react";
import type { ProposalRow } from "@/lib/agent/types";
import { renderProposalValue, fieldLabel } from "./proposalRender";

type ProposalCardProps = {
  proposal: ProposalRow;
  /** Compact mode renders inside the detail drawer; expanded for /inbox. */
  compact?: boolean;
  onResolved?: () => void;
};

export function ProposalCard({ proposal, compact, onResolved }: ProposalCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(() => stringifyForEdit(proposal.proposed_value));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (kind: "approve" | "reject", value?: unknown) => {
    setError(null);
    startTransition(async () => {
      const url = `/api/proposals/${proposal.id}/${kind}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: kind === "approve" && value !== undefined ? JSON.stringify({ value }) : "{}"
      });
      const result = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !result.ok) {
        setError(result.error ?? `Request failed (${r.status})`);
        return;
      }
      onResolved?.();
      router.refresh();
    });
  };

  const handleEditApprove = () => {
    let parsed: unknown = editValue;
    try {
      parsed = parseEditValue(proposal.field, editValue);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse edited value");
      return;
    }
    submit("approve", parsed);
  };

  return (
    <div
      className={
        compact
          ? "rounded-md border border-border-subtle bg-bg-muted p-3"
          : "rounded-lg border border-border-subtle bg-bg-surface p-4"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-badge uppercase tracking-[0.04em] text-text-tertiary">
          <span>{fieldLabel(proposal.field)}</span>
          <span>·</span>
          <span>{proposal.proposal_type === "enrichment" ? "Enrichment" : "Inspector fix"}</span>
        </div>
      </div>

      {proposal.current_value != null && (
        <div className="mt-2 text-compact text-text-tertiary line-through">
          {renderProposalValue(proposal.field, proposal.current_value)}
        </div>
      )}

      {!editing ? (
        <div className="mt-1 text-compact text-text-primary">
          {renderProposalValue(proposal.field, proposal.proposed_value)}
        </div>
      ) : (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="mt-1 w-full rounded-md border border-border-subtle bg-bg-inset p-2 font-sans text-compact text-text-primary outline-none focus:border-brand"
          rows={editorRows(proposal.field)}
        />
      )}

      {proposal.rationale && (
        <div className="mt-2 text-label italic text-text-secondary">{proposal.rationale}</div>
      )}

      {error && (
        <div className="mt-2 rounded-md border border-status-blocked/40 bg-status-blocked-soft p-2 text-label text-status-blocked-text">
          {error}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {!editing ? (
          <>
            <Btn onClick={() => submit("approve")} disabled={pending} kind="primary">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleCheck className="h-3.5 w-3.5" />}
              Approve
            </Btn>
            <Btn onClick={() => setEditing(true)} disabled={pending}>
              <Pencil className="h-3.5 w-3.5" />
              Edit & approve
            </Btn>
            <Btn onClick={() => submit("reject")} disabled={pending} kind="ghost">
              <CircleX className="h-3.5 w-3.5" />
              Reject
            </Btn>
          </>
        ) : (
          <>
            <Btn onClick={handleEditApprove} disabled={pending} kind="primary">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleCheck className="h-3.5 w-3.5" />}
              Save
            </Btn>
            <Btn onClick={() => { setEditing(false); setError(null); }} disabled={pending}>
              Cancel
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  kind = "default"
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  kind?: "primary" | "ghost" | "default";
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-label transition-colors disabled:opacity-50";
  const styles =
    kind === "primary"
      ? "border border-border-subtle bg-bg-surface text-text-primary hover:bg-bg-muted"
      : kind === "ghost"
        ? "text-text-secondary hover:text-text-primary"
        : "border border-border-subtle bg-bg-surface text-text-secondary hover:bg-bg-muted";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function editorRows(field: string): number {
  if (field === "brief") return 4;
  if (field === "acceptance_criteria") return 6;
  if (field === "risk_rationale") return 2;
  return 2;
}

function stringifyForEdit(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function parseEditValue(field: string, raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (field === "brief" || field === "risk_rationale") return trimmed;
  if (field === "effort_estimate" || field === "risk_level") return trimmed;
  if (field === "acceptance_criteria") {
    // Accept either JSON or one criterion per line.
    if (trimmed.startsWith("[")) return JSON.parse(trimmed);
    return trimmed
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*[-*]\s*/, "").trim())
      .filter(Boolean)
      .map((text) => ({ text, done: false }));
  }
  if (field === "related_item_ids") {
    if (trimmed.startsWith("[")) return JSON.parse(trimmed);
    return trimmed
      .split(/[,\s]+/)
      .map((s) => Number(s.replace(/^#/, "")))
      .filter((n) => Number.isFinite(n));
  }
  return trimmed;
}
