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
    <div className="border-b border-border-subtle bg-status-blocked-soft px-4 py-2 text-label text-status-blocked-text">
      Sync failing since {since}. Data may be stale.
    </div>
  );
}
