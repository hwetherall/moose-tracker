"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { formatRelative } from "@/lib/format";

type SyncStatus = {
  lastSyncedAt: string | null;
  lastStatus: "ok" | "error" | "partial" | "running" | null;
  consecutiveFailures: number;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function LastSyncedFooter() {
  const { data } = useSWR<SyncStatus>("/api/sync-status", fetcher, { refreshInterval: 30_000 });
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const ts = data?.lastSyncedAt ? new Date(data.lastSyncedAt) : null;
  const age = ts ? Date.now() - ts.getTime() : Infinity;
  const dot =
    data?.lastStatus === "error" || age > 30 * 60_000
      ? "bg-status-blocked"
      : age > 10 * 60_000
        ? "bg-status-discovery"
        : "bg-status-done";
  return (
    <div className="mt-auto border-t border-border-subtle px-1 pt-4 text-label">
      <div className="flex items-center gap-2 text-text-secondary">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span>Last synced</span>
      </div>
      <div className="mt-1 text-text-tertiary">{ts ? formatRelative(ts) : "unavailable"}</div>
      {data?.lastStatus === "error" && data.consecutiveFailures >= 2 && (
        <div className="mt-1 text-status-blocked-text">Sync failing</div>
      )}
    </div>
  );
}
