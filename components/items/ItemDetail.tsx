import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { StatusDot } from "./StatusDot";
import { TypeBadge } from "./TypeBadge";
import { daysSince, formatDateShort } from "@/lib/format";
import type { Row } from "@/lib/queries/planning";
import type { ExpRow } from "@/lib/queries/experiments";

function sheetDeepLink(sheetRow: number): string {
  const id = process.env.MOOSE_SHEET_ID ?? "";
  const gid = process.env.PLANNING_GID ?? "";
  if (!id) return "#";
  return `https://docs.google.com/spreadsheets/d/${id}/edit#gid=${gid}&range=A${sheetRow}`;
}

function jiraLink(key: string): string {
  const base = process.env.JIRA_BASE_URL ?? "https://innovera.atlassian.net/browse";
  return `${base}/${key}`;
}

function ownerLine(label: string, emails: string[], raw: string | null) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="w-20 shrink-0 text-ink-mute">{label}</span>
      <span className="text-ink-soft">
        {emails.length ? emails.map((e) => e.split("@")[0]).join(", ") : (raw ?? "—")}
      </span>
    </div>
  );
}

export function ItemDetail({
  row,
  experiments,
  parent,
  children
}: {
  row: Row;
  experiments: ExpRow[];
  parent: Row | null;
  children: Row[];
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-paper-line p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-ink-mute">
            <span className="font-mono">#{row.id}</span>
            <TypeBadge type={row.type} />
            {row.release && <span className="rounded bg-paper-mute px-1.5 py-0.5">{row.release}</span>}
            <span className="font-mono">Rank {row.rank_score ?? "—"}</span>
          </div>
          <h2 className="mt-1.5 text-base font-semibold text-ink leading-tight">{row.name}</h2>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <StatusDot status={row.status} />
              <span className="text-ink-soft">{row.status}</span>
            </span>
            {row.due_date && <span className="text-ink-mute">Due {formatDateShort(row.due_date)}</span>}
            {row.is_ready === true && (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-800">Ready</span>
            )}
          </div>
        </div>
        <a
          href={sheetDeepLink(row.sheet_row)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-xs text-ink-soft hover:bg-paper-mute"
        >
          Open in Sheet <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
        <Section title="Ownership">
          {ownerLine("Responsible", row.r_emails, row.r_raw)}
          {ownerLine("Accountable", row.a_emails, row.a_raw)}
          {ownerLine("Definer", row.d_emails, row.d_raw)}
        </Section>

        <Section title="Classification">
          <Field label="Category" value={row.category} />
          <Field label="Subsystem" value={row.subsystem} />
          <Field label="Seq" value={row.seq} />
          <Field label="P / I / D" value={`${row.priority ?? "?"} / ${row.impact ?? "?"} / ${row.difficulty ?? "?"}`} />
        </Section>

        {row.blocker || row.blocked_since ? (
          <Section title="Block">
            <div className="rounded-md border border-status-blocked/30 bg-red-50 p-3 text-xs text-ink-soft">
              <div>{row.blocker ?? "—"}</div>
              {row.blocked_since && (
                <div className="mt-1 text-status-blocked">
                  Blocked since {formatDateShort(row.blocked_since)}
                  {" · "}
                  {daysSince(row.blocked_since)}d
                </div>
              )}
            </div>
          </Section>
        ) : null}

        {row.dod && (
          <Section title="Definition of Done">
            <p className="whitespace-pre-wrap text-xs text-ink-soft">{row.dod}</p>
          </Section>
        )}

        {row.comments && (
          <Section title="Comments">
            <p className="whitespace-pre-wrap text-xs text-ink-soft">{row.comments}</p>
          </Section>
        )}

        {row.links.length > 0 && (
          <Section title="Links">
            <div className="flex flex-wrap gap-1.5">
              {row.links.map((l) => {
                const href =
                  l.type === "jira_prmt" || l.type === "jira_inv" ? jiraLink(l.id) : "#";
                return (
                  <a
                    key={l.raw}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-paper-line bg-paper-soft px-2 py-0.5 text-[11px] text-ink-soft hover:bg-paper-mute"
                  >
                    {l.id}
                  </a>
                );
              })}
            </div>
          </Section>
        )}

        {experiments.length > 0 && (
          <Section title="Experiments">
            <div className="space-y-1.5">
              {experiments.map((e) => (
                <div key={e.key} className="rounded-md border border-paper-line bg-paper p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-ink-mute">{e.key}</span>
                    <StatusDot status={e.status} />
                    <span className="text-ink-soft">{e.status}</span>
                  </div>
                  {e.experiment && <div className="mt-0.5 text-ink">{e.experiment}</div>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {parent && (
          <Section title="Parent Epic">
            <Link
              href={`/item/${parent.id}`}
              prefetch={false}
              className="block rounded-md border border-paper-line bg-paper p-2 text-xs hover:bg-paper-mute"
            >
              <span className="font-mono text-ink-mute">#{parent.id}</span> <span className="text-ink">{parent.name}</span>
            </Link>
          </Section>
        )}

        {children.length > 0 && (
          <Section title={`Children (${children.length})`}>
            <div className="space-y-1.5">
              {children.map((c) => (
                <Link
                  key={c.id}
                  href={`/item/${c.id}`}
                  prefetch={false}
                  className="block rounded-md border border-paper-line bg-paper p-2 text-xs hover:bg-paper-mute"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-ink-mute">#{c.id}</span>
                    <StatusDot status={c.status} />
                    <span className="text-ink">{c.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        <details className="rounded-md border border-paper-line bg-paper-soft p-3">
          <summary className="cursor-pointer text-xs font-medium text-ink-soft">Raw data</summary>
          <div className="mt-2 space-y-1 text-[11px] text-ink-mute">
            <Field label="status_raw" value={row.status_raw} mono />
            <Field label="r_raw" value={row.r_raw} mono />
            <Field label="a_raw" value={row.a_raw} mono />
            <Field label="d_raw" value={row.d_raw} mono />
            <Field label="parent_epic" value={row.parent_epic} mono />
          </div>
        </details>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-mute">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="w-20 shrink-0 text-ink-mute">{label}</span>
      <span className={mono ? "font-mono text-ink-soft" : "text-ink-soft"}>{value ?? "—"}</span>
    </div>
  );
}
