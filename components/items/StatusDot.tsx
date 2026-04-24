import { cn } from "@/lib/utils";

const MAP: Record<string, string> = {
  "0-Done": "bg-status-done",
  "0-Blocked": "bg-status-blocked",
  "0-?": "bg-status-unknown",
  "1-InDev": "bg-status-indev",
  "1-InDevPrompt": "bg-status-indev",
  "2-ReadyForDev": "bg-status-ready",
  "3-Discovery": "bg-status-discovery",
  "3-Design": "bg-status-design",
  "4-Experiment": "bg-status-experiment",
  "5-Backlog": "bg-status-backlog"
};

export function StatusDot({ status, className }: { status: string; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", MAP[status] ?? "bg-status-unknown", className)} aria-hidden />;
}

export function statusLabel(status: string): string {
  return status;
}
