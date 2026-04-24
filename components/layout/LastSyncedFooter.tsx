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
  return (
    <div className="border-t border-paper-line p-3 text-xs text-ink-mute">
      <div>Last synced: {ts ? formatRelative(ts) : "—"}</div>
      {data?.lastStatus === "error" && data.consecutiveFailures >= 2 && (
        <div className="mt-1 text-status-blocked">Sync failing</div>
      )}
    </div>
  );
}
