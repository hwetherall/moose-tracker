import { auth } from "@/lib/auth";
import { fetchPlanningItems } from "@/lib/queries/planning";
import { fetchReleases } from "@/lib/queries/releases";
import { ItemCard } from "@/components/items/ItemCard";
import { StatusDot } from "@/components/items/StatusDot";
import Link from "next/link";
import { daysSince, daysUntil, formatDateShort } from "@/lib/format";

const ACTIVE_STATUSES = ["1-InDev", "1-InDevPrompt", "2-ReadyForDev", "3-Discovery", "3-Design", "4-Experiment"];
const DONE_STATUSES = ["0-Done"];

export default async function OverviewPage() {
  const [session, items, releases] = await Promise.all([
    auth(),
    fetchPlanningItems({}),
    fetchReleases()
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
    .slice(0, 5);

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

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active items" value={active} />
        <Stat label="Blocked" value={blocked.length} accent={blocked.length > 0 ? "blocked" : undefined} />
        <Stat label="Due this week" value={dueWithin7} accent={dueWithin7 > 0 ? "warn" : undefined} />
        <Stat
          label={`Release ${currentRelease ?? "—"}`}
          value={slipDays !== null ? `${slipDays >= 0 ? "+" : ""}${slipDays}d` : "on track"}
          accent={slipDays !== null && slipDays > 0 ? "warn" : undefined}
          hint={
            currentReleaseMeta?.planned_prod
              ? `planned ${formatDateShort(currentReleaseMeta.planned_prod)}${
                  currentReleaseMeta.revised_prod
                    ? ` → ${formatDateShort(currentReleaseMeta.revised_prod)}`
                    : ""
                }`
              : undefined
          }
        />
      </section>

      <section>
        <SectionHeader title="Blocked" link={{ href: "/blocked", label: "See all" }} />
        {topBlocked.length === 0 ? (
          <Empty>Nothing blocked. Enjoy it.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {topBlocked.map((r) => (
              <ItemCard key={r.id} row={r} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title={`This release${currentRelease ? ` — ${currentRelease}` : ""}`}
          link={{ href: `/release${currentRelease ? `?release=${currentRelease}` : ""}`, label: "See release view" }}
        />
        {releaseItems.length === 0 ? (
          <Empty>No items in flight for this release.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(["2-ReadyForDev", "1-InDev", "0-Done"] as const).map((col) => {
              const cards = releaseItems.filter(
                (i) => i.status === col || (col === "1-InDev" && i.status === "1-InDevPrompt")
              );
              return (
                <div key={col} className="min-w-0">
                  <div className="mb-2 flex items-center gap-2 text-xs text-ink-mute">
                    <StatusDot status={col} />
                    <span className="font-medium text-ink">{col}</span>
                    <span className="text-ink-mute">({cards.length})</span>
                  </div>
                  <div className="space-y-2">
                    {cards.map((r) => (
                      <ItemCard key={r.id} row={r} />
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
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
  accent?: "warn" | "blocked";
}) {
  const ring =
    accent === "blocked"
      ? "border-status-blocked/30"
      : accent === "warn"
        ? "border-amber-300"
        : "border-paper-line";
  return (
    <div className={`rounded-md border bg-paper p-3 ${ring}`}>
      <div className="text-xs text-ink-mute">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-mute">{hint}</div>}
    </div>
  );
}

function SectionHeader({
  title,
  link
}: {
  title: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
      {link && (
        <Link href={link.href} className="text-xs text-brand hover:underline">
          {link.label}
        </Link>
      )}
    </div>
  );
}

function Empty({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <div
      className={
        small
          ? "rounded-md border border-dashed border-paper-line bg-paper-soft p-2 text-[11px] text-ink-mute"
          : "rounded-md border border-dashed border-paper-line bg-paper-soft p-6 text-xs text-ink-mute"
      }
    >
      {children}
    </div>
  );
}
