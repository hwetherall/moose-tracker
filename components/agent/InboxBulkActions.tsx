"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ProposalRow } from "@/lib/agent/types";

export function InboxBulkActions({
  itemId,
  proposals
}: {
  itemId: number;
  proposals: ProposalRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const enrichmentProposals = proposals.filter((p) => p.proposal_type === "enrichment");

  const approveAllEnrichment = () => {
    if (enrichmentProposals.length === 0) return;
    setError(null);
    startTransition(async () => {
      let firstError: string | null = null;
      for (const p of enrichmentProposals) {
        const r = await fetch(`/api/proposals/${p.id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        });
        const result = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!r.ok || !result.ok) {
          firstError = result.error ?? `Failed on proposal #${p.id}`;
          break;
        }
      }
      if (firstError) setError(firstError);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      {enrichmentProposals.length > 1 && (
        <button
          type="button"
          onClick={approveAllEnrichment}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-surface px-2 py-1 text-label text-text-secondary hover:bg-bg-muted disabled:opacity-50"
          title={`Approve all ${enrichmentProposals.length} enrichment proposals on item #${itemId}`}
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          Approve all enrichment
        </button>
      )}
      {error && <span className="text-label text-status-blocked-text">{error}</span>}
    </div>
  );
}
