"use client";

import useSWR from "swr";

type SyncStatus = {
  lastSyncedAt: string | null;
  lastStatus: "ok" | "error" | "partial" | "running" | null;
  consecutiveFailures: number;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function SyncBanner() {
  const { data } = useSWR<SyncStatus>("/api/sync-status", fetcher, { refreshInterval: 60_000 });
  if (!data) return null;
  if (data.consecutiveFailures < 2) return null;
  const since = data.lastSyncedAt ? new Date(data.lastSyncedAt).toLocaleString() : "unknown";
  return (
    <div className="border-b border-status-blocked/30 bg-red-50 px-4 py-2 text-xs text-status-blocked">
      Sync failing since {since}. Data may be stale.
    </div>
  );
}
