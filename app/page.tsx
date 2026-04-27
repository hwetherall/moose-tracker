import { auth } from "@/lib/auth";
import { fetchPlanningItems } from "@/lib/queries/planning";
import { fetchReleases } from "@/lib/queries/releases";
import { ItemCard } from "@/components/items/ItemCard";
import { StatusDot } from "@/components/items/StatusDot";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SignalsGrid } from "@/components/signals/SignalsGrid";
import { getSignals } from "@/lib/signals";
import { displayNameForEmail } from "@/lib/people";
import { daysSince, daysUntil, formatDateShort } from "@/lib/format";

const ACTIVE_STATUSES = ["1-InDev", "1-InDevPrompt", "2-ReadyForDev", "3-Discovery", "3-Design", "4-Experiment"];
const DONE_STATUSES = ["0-Done"];

export default async function OverviewPage() {
  const [session, items, releases, signals] = await Promise.all([
    auth(),
    fetchPlanningItems({}),
    fetchReleases(),
    getSignals()
  ]);
  const userEmail = session?.user?.email ?? "";

  const active = items.filter((i) => ACTIVE_STATUSES.includes(i.status)).length;
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

  const topBlocked = [...blocked]
    .sort((a, b) => (daysSince(b.blocked_since) ?? 0) - (daysSince(a.blocked_since) ?? 0))
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
        .sort((a, b) => (a.rank_score ?? 9999) - (b.rank_score ?? 9999))
        .slice(0, 10)
    : [];

  const ownerCounts = new Map<string, number>();
  for (const item of items) {
    if (!ACTIVE_STATUSES.includes(item.status)) continue;
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
      <section className="grid overflow-hidden rounded-xl border border-border-subtle bg-bg-surface md:grid-cols-[1.1fr_1fr_1fr_1fr_1fr]">
        <Stat
          label={`Release ${currentRelease ?? "none"}`}
          value={slipDays !== null && slipDays > 0 ? "At risk" : currentRelease ? "On track" : "No release"}
          accent={slipDays !== null && slipDays > 0 ? "blocked" : currentRelease ? "done" : undefined}
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
        <Stat label="Active items" value={active} />
        <Stat label="Blocked" value={blocked.length} accent={blocked.length > 0 ? "blocked" : undefined} />
        <Stat label="Due this week" value={dueWithin7} accent={dueWithin7 > 0 ? "warn" : undefined} />
        <Stat
          label="Top owner"
          value={topOwner ? displayNameForEmail(topOwner[0]) : "—"}
          hint={topOwner ? `${topOwner[1]} active items` : undefined}
        />
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
                    {cards.map((r) => (
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
  hint?: string;
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
