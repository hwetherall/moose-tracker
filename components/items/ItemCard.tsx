import Link from "next/link";
import { ExternalLink, AlertCircle } from "lucide-react";
import type { Row } from "@/lib/queries/planning";
import { StatusDot } from "./StatusDot";
import { TypeBadge } from "./TypeBadge";
import { daysSince, daysUntil, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

function sheetDeepLink(sheetRow: number): string {
  const id = process.env.MOOSE_SHEET_ID ?? "";
  const gid = process.env.PLANNING_GID ?? "";
  if (!id) return "#";
  return `https://docs.google.com/spreadsheets/d/${id}/edit#gid=${gid}&range=A${sheetRow}`;
}

function shortNames(emails: string[]): string {
  if (!emails.length) return "—";
  const names = emails.map((e) => e.split("@")[0]);
  return names.join(", ");
}

export function ItemCard({ row }: { row: Row }) {
  const due = daysUntil(row.due_date);
  const blockedDays = daysSince(row.blocked_since);
  const showBlockedWarn = (blockedDays !== null && blockedDays >= 7) || !!row.blocker;

  const dueClass =
    row.due_date && due !== null
      ? due < 0
        ? "text-status-blocked"
        : due <= 7
          ? "text-amber-600"
          : "text-ink-mute"
      : "text-ink-mute";

  return (
    <Link
      href={`/item/${row.id}`}
      prefetch={false}
      className="block rounded-md border border-paper-line bg-paper p-3 hover:border-brand hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-ink-mute">
          <span className="font-mono">#{row.id}</span>
          <TypeBadge type={row.type} />
          {row.release && <span className="rounded bg-paper-mute px-1.5 py-0.5">{row.release}</span>}
        </div>
        <span className="text-[10px] font-mono text-ink-mute">Rank {row.rank_score ?? "—"}</span>
      </div>

      <div className="mt-1.5 text-sm font-medium text-ink leading-snug line-clamp-2">{row.name}</div>

      {(row.category || row.subsystem) && (
        <div className="mt-1 text-[11px] text-ink-mute">
          {[row.category, row.subsystem].filter(Boolean).join(" · ")}
        </div>
      )}

      <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-soft">
        <span>R: {shortNames(row.r_emails)}</span>
        <span>A: {shortNames(row.a_emails)}</span>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={row.status} />
          <span className="text-ink-soft">{row.status}</span>
        </span>
        <span className={cn(dueClass)}>{row.due_date ? `Due ${formatDateShort(row.due_date)}` : ""}</span>
      </div>

      {showBlockedWarn && (
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center gap-1 text-status-blocked">
            <AlertCircle className="h-3 w-3" />
            {blockedDays !== null ? `Blocked ${blockedDays}d` : "Blocked"}
          </span>
          <a
            href={sheetDeepLink(row.sheet_row)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 text-ink-mute hover:text-ink"
          >
            Sheet <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </Link>
  );
}
