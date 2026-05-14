import { auth } from "@/lib/auth";
import Link from "next/link";
import { ACTIVE_STATUSES, compareByPriority, fetchPlanningItems, fetchTopPriorities, type Row } from "@/lib/queries/planning";
import { fetchReleases } from "@/lib/queries/releases";
import { ItemCard } from "@/components/items/ItemCard";
import { StatusDot } from "@/components/items/StatusDot";
import { TypeBadge } from "@/components/items/TypeBadge";
import { OwnerAvatar } from "@/components/items/OwnerAvatar";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SignalsGrid } from "@/components/signals/SignalsGrid";
import { BriefCard } from "@/components/agent/BriefCard";
import { fetchTodaysBrief } from "@/lib/queries/agent";
import { getSignals } from "@/lib/signals";
import { displayNameForEmail } from "@/lib/people";
import { daysSince, daysUntil, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

const DONE_STATUSES = ["0-Done"];

export default async function OverviewPage() {
  const [session, items, releases, signals, topPriorities, todaysBrief] = await Promise.all([
    auth(),
    fetchPlanningItems({}),
    fetchReleases(),
    getSignals(),
    fetchTopPriorities(),
    fetchTodaysBrief()
  ]);
  const userEmail = session?.user?.email ?? "";

  const activeItems = items.filter((i) => (ACTIVE_STATUSES as readonly string[]).includes(i.status));
  const active = activeItems.length;
  const blocked = items.filter((i) => i.status === "0-Blocked" || !!i.blocker);
  const dueWithin7 = items.filter((i) => {
    if (DONE_STATUSES.includes(i.status)) return false;
    const du = daysUntil(i.due_date);
    return du !== null && du <= 7 && du >= 0;
  }).length;

  // Current release = next release with any non-done items
  const releaseOrder = ["R14", "R15", "R16.1", "R16.2", "R17", "R18"];
  const currentRelease = releaseOrder.find((r) =>
    items.some((i) => i.release === r && !DONE_STATUSES.includes(i.status))
  ) ?? null;
  const currentReleaseMeta = currentRelease ? releases.find((r) => r.name === currentRelease) : null;
  const slipDays =
    currentReleaseMeta?.planned_prod && currentReleaseMeta?.revised_prod
      ? Math.round(
          (new Date(currentReleaseMeta.revised_prod).getTime() -
            new Date(currentReleaseMeta.planned_prod).getTime()) /
            86_400_000
        )
      : null;
  // A release is past-due when planned_prod is behind us and no actual_prod has
  // been recorded. The old logic only considered revised_prod vs planned_prod,
  // so a release blew its date but kept showing "On track" until someone filled
  // in the revised column.
  const plannedProdMs = currentReleaseMeta?.planned_prod
    ? new Date(currentReleaseMeta.planned_prod).getTime()
    : null;
  const actualProdMs = currentReleaseMeta?.actual_prod
    ? new Date(currentReleaseMeta.actual_prod).getTime()
    : null;
  const isShipped = actualProdMs !== null;
  const isPastDue = !isShipped && plannedProdMs !== null && plannedProdMs < Date.now();
  const isAtRisk = !isShipped && ((slipDays !== null && slipDays > 0) || isPastDue);
  const releaseStatusLabel = !currentRelease
    ? "No release"
    : isShipped
      ? "Shipped"
      : isAtRisk
        ? "At risk"
        : "On track";
  const releaseStatusAccent: "warn" | "blocked" | "done" | undefined = !currentRelease
    ? undefined
    : isShipped
      ? "done"
      : isAtRisk
        ? "blocked"
        : "done";

  const topBlocked = [...blocked]
    .sort((a, b) => {
      const stuckDelta = (daysSince(b.blocked_since) ?? 0) - (daysSince(a.blocked_since) ?? 0);
      return stuckDelta || compareByPriority(a, b);
    })
    .slice(0, 4);

  const releaseItems = items
    .filter((i) => i.release === currentRelease)
    .filter((i) => ["2-ReadyForDev", "1-InDev", "1-InDevPrompt", "0-Done"].includes(i.status));

  const myQueue = userEmail
    ? items
        .filter(
          (i) =>
            i.r_emails.includes(userEmail) ||
            i.a_emails.includes(userEmail) ||
            i.d_emails.includes(userEmail)
        )
        .filter((i) => !DONE_STATUSES.includes(i.status))
        .sort(compareByPriority)
        .slice(0, 10)
    : [];

  const ownerCounts = new Map<string, number>();
  for (const item of items) {
    if (!(ACTIVE_STATUSES as readonly string[]).includes(item.status)) continue;
    for (const e of new Set([...item.r_emails, ...item.a_emails])) {
      ownerCounts.set(e, (ownerCounts.get(e) ?? 0) + 1);
    }
  }
  const topOwner = Array.from(ownerCounts.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;

  const releaseTypeCounts = new Map<string, number>();
  for (const item of releaseItems) {
    const t = item.type ?? "Other";
    releaseTypeCounts.set(t, (releaseTypeCounts.get(t) ?? 0) + 1);
  }
  const releaseComposition = Array.from(releaseTypeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${count} ${type}`)
    .join(" · ");

  return (
    <div className="space-y-9">
      {todaysBrief && !todaysBrief.error && todaysBrief.body_html && (
        <BriefCard
          briefId={todaysBrief.id}
          briefDate={todaysBrief.brief_date}
          bodyHtml={todaysBrief.body_html}
          generatedAt={todaysBrief.generated_at}
        />
      )}

      <section className="grid overflow-hidden rounded-xl border border-border-subtle bg-bg-surface md:grid-cols-[1.1fr_1fr_1fr_1fr_1fr]">
        <Stat
          label={`Release ${currentRelease ?? "none"}`}
          value={releaseStatusLabel}
          accent={releaseStatusAccent}
          hint={
            currentReleaseMeta?.planned_prod
              ? `planned ${formatDateShort(currentReleaseMeta.planned_prod)}${
                  currentReleaseMeta.revised_prod
                    ? ` to ${formatDateShort(currentReleaseMeta.revised_prod)}`
                    : ""
                }`
              : undefined
          }
        />
        <Stat label="Active items" value={active} hint="items in flight" />
        <Stat label="Blocked" value={blocked.length} accent={blocked.length > 0 ? "blocked" : undefined} />
        <Stat label="Due this week" value={dueWithin7} accent={dueWithin7 > 0 ? "warn" : undefined} />
        <Stat
          label="Top owner"
          value={topOwner ? displayNameForEmail(topOwner[0]) : "—"}
          hint={topOwner ? `${topOwner[1]} active items` : undefined}
        />
      </section>

      <section>
        <SectionHeader
          title="Top priorities"
          subtitle="Ordered by Seq (sheet column D)"
          linkHref="/items"
          linkText="See all priorities"
        />
        {topPriorities.length === 0 ? (
          <Empty>No sequenced items right now.</Empty>
        ) : (
          <div className="space-y-2">
            {topPriorities.map((row, index) => (
              <TopPriorityRow key={row.id} row={row} ordinal={index + 1} />
            ))}
          </div>
        )}
      </section>

      <SignalsGrid signals={signals} />

      <section>
        <SectionHeader title="Blocked" linkHref="/blocked" linkText={`See all ${blocked.length}`} dense />
        {topBlocked.length === 0 ? (
          <Empty>Nothing blocked. Enjoy it.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {topBlocked.map((r) => (
              <ItemCard key={r.id} row={r} />
            ))}
          </div>
        )}
      </section>

      {myQueue.length > 0 && (
        <section>
          <SectionHeader title="My queue" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {myQueue.map((r) => (
              <ItemCard key={r.id} row={r} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeader
          title={`This release${currentRelease ? ` — ${currentRelease}` : ""}`}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>
                {currentReleaseMeta?.planned_prod
                  ? `Planned ${formatDateShort(currentReleaseMeta.planned_prod)} · ${releaseItems.length} items`
                  : `${releaseItems.length} items`}
              </span>
              {releaseComposition && (
                <span className="rounded-sm bg-bg-muted px-1.5 py-0.5 text-badge text-text-secondary">
                  {releaseComposition}
                </span>
              )}
            </span>
          }
          linkHref={`/release${currentRelease ? `?release=${currentRelease}` : ""}`}
          linkText="See full release"
        />
        {releaseItems.length === 0 ? (
          <Empty>No items in flight for this release.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {(["2-ReadyForDev", "1-InDev", "0-Done"] as const).map((col) => {
              const cards = releaseItems.filter(
                (i) => i.status === col || (col === "1-InDev" && i.status === "1-InDevPrompt")
              );
              return (
                <div key={col} className="min-w-0">
                  <div className="mb-2 flex items-center gap-2 text-label text-text-tertiary">
                    <StatusDot status={col} />
                    <span className="text-text-primary">{col}</span>
                    <span>({cards.length})</span>
                  </div>
                  <div className="space-y-2">
                    {[...cards].sort(compareByPriority).map((r) => (
                      <ItemCard key={r.id} row={r} compact />
                    ))}
                    {cards.length === 0 && <Empty small>Empty</Empty>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent
}: {
  label: string;
  value: string | number;
  hint?: React.ReactNode;
  accent?: "warn" | "blocked" | "done";
}) {
  const color =
    accent === "blocked"
      ? "text-status-blocked-text"
      : accent === "warn"
        ? "text-status-discovery-text"
        : accent === "done"
          ? "text-status-done-text"
          : "text-text-primary";
  return (
    <div className="border-b border-border-subtle p-[18px_22px] md:border-b-0 md:border-r md:last:border-r-0">
      <div className="text-label uppercase tracking-[0.04em] text-text-tertiary">{label}</div>
      <div className={`mt-2 font-serif text-display tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-label text-text-secondary">{hint}</div>}
    </div>
  );
}

function TopPriorityRow({ row, ordinal }: { row: Row; ordinal: number }) {
  const due = daysUntil(row.due_date);
  const blockedDays = daysSince(row.blocked_since);
  const isBlocked = row.status === "0-Blocked" || !!row.blocker;
  const ownerEmail = row.r_emails[0] ?? null;
  const ownerFirst = ownerEmail ? displayNameForEmail(ownerEmail).split(" ")[0] : null;
  const dueClass =
    row.due_date && due !== null
      ? due < 0
        ? "text-status-blocked-text"
        : due <= 7
          ? "text-status-discovery-text"
          : "text-text-tertiary"
      : "text-text-tertiary";

  return (
    <div className="flex items-start gap-2">
      <div className="w-7 shrink-0 pt-[9px] text-right font-mono text-[12px] leading-none tabular-nums text-text-tertiary">
        {ordinal}.
      </div>
      <Link
        href={`/item/${row.id}`}
        prefetch={false}
        className="min-w-0 flex-1 rounded-md border border-border-subtle bg-bg-surface px-3 py-2 transition-colors hover:border-border-medium dark:bg-bg-muted/45 dark:hover:bg-bg-muted/60"
      >
        <div className="flex min-h-5 min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="shrink-0 font-mono text-label tabular-nums text-text-tertiary">#{row.id}</span>
            <TypeBadge type={row.type} />
            <span className="min-w-0 truncate text-compact text-text-primary">{row.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex items-center gap-3 text-label">
              <span className="inline-flex items-center gap-1.5 text-text-secondary">
                <StatusDot status={row.status} />
                <span>{row.status}</span>
              </span>
              {ownerEmail && ownerFirst && (
                <span className="hidden items-center gap-1.5 text-text-secondary md:inline-flex">
                  <OwnerAvatar email={ownerEmail} size={16} />
                  <span>{ownerFirst}</span>
                </span>
              )}
              {isBlocked ? (
                <span className="hidden font-mono text-status-blocked-text md:inline">
                  {blockedDays === null ? "stuck" : `stuck ${blockedDays}d`}
                </span>
              ) : row.due_date ? (
                <span className={cn("hidden md:inline", dueClass)}>{formatDateShort(row.due_date)}</span>
              ) : null}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

function Empty({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <div
      className={
        small
          ? "rounded-md border border-dashed border-border-subtle bg-bg-muted p-2 text-label text-text-tertiary"
          : "rounded-md border border-dashed border-border-subtle bg-bg-muted p-6 text-body text-text-tertiary"
      }
    >
      {children}
    </div>
  );
}
