import Link from "next/link";
import type { Row } from "@/lib/queries/planning";
import { StatusDot } from "./StatusDot";
import { TypeBadge } from "./TypeBadge";
import { daysSince, daysUntil, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OwnerStack } from "./OwnerAvatar";
import { PriorityPill, priorityValue } from "./PriorityPill";

export function ItemCard({ row, compact = false, quoteBlocker = false }: { row: Row; compact?: boolean; quoteBlocker?: boolean }) {
  const due = daysUntil(row.due_date);
  const blockedDays = daysSince(row.blocked_since);
  const showStuck = blockedDays !== null && blockedDays > 7;
  const owners = row.r_emails.length ? row.r_emails : row.a_emails.length ? row.a_emails : row.d_emails;
  const dimBody = row.priority === 3;

  const dueClass =
    row.due_date && due !== null
      ? due < 0
        ? "text-status-blocked-text"
        : due <= 7
          ? "text-status-discovery-text"
          : "text-text-tertiary"
      : "text-text-tertiary";

  return (
    <Link
      href={`/item/${row.id}`}
      prefetch={false}
      className={cn(
        "block border border-border-subtle bg-bg-surface transition-colors hover:border-border-medium dark:bg-bg-muted/45 dark:hover:bg-bg-muted/60",
        compact ? "rounded-md px-3 py-2.5" : "rounded-lg px-4 py-3.5",
        compact && row.status === "0-Done" && "bg-bg-muted opacity-75"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn("flex min-w-0 items-center gap-1.5 text-label text-text-tertiary", dimBody && "opacity-[0.78]")}>
          <span className="font-mono">#{row.id}</span>
          <TypeBadge type={row.type} />
          {!compact && (row.category || row.subsystem) && (
            <span className="truncate text-badge text-text-tertiary">
              {[row.category, row.subsystem].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        {compact ? (
          <PriorityPill priority={priorityValue(row.priority)} rankScore={row.rank_score} size="compact" />
        ) : showStuck ? (
          <span className={cn("shrink-0 font-mono text-label text-status-blocked-text", dimBody && "opacity-[0.78]")}>
            stuck {blockedDays}d
          </span>
        ) : null}
      </div>

      <div className={cn("mt-1.5 line-clamp-2 text-text-primary", compact ? "text-compact" : "text-item", dimBody && "opacity-[0.78]")}>
        {row.name}
      </div>

      {quoteBlocker && row.blocker && (
        <blockquote className={cn("mt-2 border-l border-border-medium pl-3 text-compact italic text-text-secondary", dimBody && "opacity-[0.78]")}>
          {row.blocker}
        </blockquote>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className={cn("min-w-0", dimBody && "opacity-[0.78]")}>
          <OwnerStack emails={owners} size={compact ? 16 : 18} />
        </div>
        {!compact && <PriorityPill priority={priorityValue(row.priority)} rankScore={row.rank_score} />}
      </div>

      {!compact && (
        <div className={cn("mt-2 flex items-center justify-between text-label", dimBody && "opacity-[0.78]")}>
          <span className="inline-flex items-center gap-1.5 text-text-secondary">
            <StatusDot status={row.status} />
            <span>{row.status}</span>
          </span>
          <span className={cn(dueClass)}>{row.due_date ? `Due ${formatDateShort(row.due_date)}` : ""}</span>
        </div>
      )}
    </Link>
  );
}
