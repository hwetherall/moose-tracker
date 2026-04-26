"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function RefreshButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { mutate } = useSWRConfig();

  async function onClick() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error ?? "Refresh failed");
      // Revalidate everything SWR-keyed
      await mutate(() => true, undefined, { revalidate: true });
      setMsg(data.skipped ? "Already running" : "Updated");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 2500);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-label text-text-tertiary">{msg}</span>}
      <button
        onClick={onClick}
        disabled={busy}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-body text-text-secondary hover:bg-bg-muted hover:text-text-primary disabled:opacity-60"
        )}
      >
        <RefreshCw className={cn("h-3 w-3", busy && "animate-spin")} />
        {busy ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
