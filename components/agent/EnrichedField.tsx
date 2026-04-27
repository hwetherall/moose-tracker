"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import type { ItemEnrichmentRow, ProposalRow } from "@/lib/agent/types";
import { ProposalCard } from "./ProposalCard";
import { fieldLabel, renderProposalValue } from "./proposalRender";

type Field =
  | "brief"
  | "acceptance_criteria"
  | "effort_estimate"
  | "risk_level"
  | "risk_rationale"
  | "related_item_ids";

const FIELDS: Field[] = [
  "brief",
  "acceptance_criteria",
  "effort_estimate",
  "risk_level",
  "risk_rationale",
  "related_item_ids"
];

export function EnrichmentSection({
  itemId,
  enrichment,
  pending
}: {
  itemId: number;
  enrichment: ItemEnrichmentRow | null;
  pending: ProposalRow[];
}) {
  const isAllEmpty =
    !enrichment ||
    (
      !enrichment.brief &&
      enrichment.acceptance_criteria.length === 0 &&
      !enrichment.effort_estimate &&
      !enrichment.risk_level &&
      !enrichment.risk_rationale &&
      enrichment.related_item_ids.length === 0
    );
  const noPending = pending.length === 0;

  return (
    <div className="rounded-md border border-border-subtle bg-bg-muted p-3">
      <div className="mb-2 flex items-center gap-1.5 text-badge uppercase tracking-[0.04em] text-text-tertiary">
        <Sparkles className="h-3 w-3" />
        AI-enriched
      </div>

      <div className="space-y-2">
        {FIELDS.map((field) => (
          <FieldRow
            key={field}
            field={field}
            current={currentValueFor(field, enrichment)}
            proposal={pending.find((p) => p.field === field) ?? null}
          />
        ))}
      </div>

      {isAllEmpty && noPending && <SuggestOne itemId={itemId} />}
    </div>
  );
}

function FieldRow({
  field,
  current,
  proposal
}: {
  field: Field;
  current: unknown;
  proposal: ProposalRow | null;
}) {
  if (proposal) {
    return <ProposalCard proposal={proposal} compact />;
  }
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-32 shrink-0 text-label uppercase tracking-[0.04em] text-text-tertiary">
        {fieldLabel(field)}
      </span>
      <div className="min-w-0 flex-1 text-compact text-text-secondary">
        {current == null || current === "" ? (
          <span className="italic text-text-tertiary">—</span>
        ) : (
          renderProposalValue(field, current)
        )}
      </div>
    </div>
  );
}

function SuggestOne({ itemId }: { itemId: number }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await fetch("/api/agent/enrich-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId })
      });
      const result = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !result.ok) {
        setError(result.error ?? `Request failed (${r.status})`);
        return;
      }
      setDone(true);
      // Soft refresh — let the user see the new proposals appear.
      setTimeout(() => window.location.reload(), 700);
    });
  };

  return (
    <div className="mt-3 border-t border-border-subtle pt-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || done}
        className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1 text-label text-text-secondary hover:bg-bg-muted disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {done ? "Suggesting…" : pending ? "Asking the agent…" : "Suggest one"}
      </button>
      {error && (
        <div className="mt-2 text-label text-status-blocked-text">{error}</div>
      )}
    </div>
  );
}

function currentValueFor(field: Field, enrichment: ItemEnrichmentRow | null): unknown {
  if (!enrichment) return null;
  switch (field) {
    case "brief":
      return enrichment.brief;
    case "acceptance_criteria":
      return enrichment.acceptance_criteria;
    case "effort_estimate":
      return enrichment.effort_estimate;
    case "risk_level":
      return enrichment.risk_level;
    case "risk_rationale":
      return enrichment.risk_rationale;
    case "related_item_ids":
      return enrichment.related_item_ids?.length ? enrichment.related_item_ids : null;
  }
}
