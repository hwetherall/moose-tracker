"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Info, BellOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FindingRow } from "@/lib/agent/types";

const SEVERITY_BORDER: Record<FindingRow["severity"], string> = {
  warning: "border-l-status-blocked",
  observation: "border-l-status-discovery"
};

const SEVERITY_ICON: Record<FindingRow["severity"], typeof AlertCircle> = {
  warning: AlertCircle,
  observation: Info
};

export function InspectorBadge({ finding }: { finding: FindingRow }) {
  const Icon = SEVERITY_ICON[finding.severity];
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const muteThisCheck = () => {
    startTransition(async () => {
      // Read current prefs, append, PUT.
      const r = await fetch("/api/agent/preferences");
      const prefs = (await r.json().catch(() => ({}))) as {
        suppressed_check_ids?: string[];
      };
      const next = Array.from(
        new Set([...(prefs.suppressed_check_ids ?? []), finding.check_id])
      );
      await fetch("/api/agent/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suppressed_check_ids: next })
      });
      router.refresh();
    });
  };

  return (
    <div
      className={`rounded-r-md border border-l-2 border-border-subtle bg-bg-surface p-3 ${SEVERITY_BORDER[finding.severity]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-label text-text-secondary">
          <Icon className="h-3 w-3" />
          <span className="font-medium text-text-primary">{finding.title}</span>
          <span className="text-text-tertiary">·</span>
          <span className="text-text-tertiary">{finding.check_id}</span>
        </div>
        <button
          type="button"
          onClick={muteThisCheck}
          disabled={pending}
          title="Mute this check for me"
          className="text-text-tertiary hover:text-text-primary disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <BellOff className="h-3 w-3" />}
        </button>
      </div>
      <p className="mt-1 text-compact text-text-secondary">{finding.detail}</p>
    </div>
  );
}

export function InspectorFindingList({ findings }: { findings: FindingRow[] }) {
  if (findings.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-badge uppercase tracking-[0.04em] text-text-tertiary">
        Inspector findings
      </h3>
      <div className="space-y-2">
        {findings.map((f) => (
          <InspectorBadge key={f.id} finding={f} />
        ))}
      </div>
    </div>
  );
}
