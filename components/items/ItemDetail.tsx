import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { StatusDot } from "./StatusDot";
import { TypeBadge } from "./TypeBadge";
import { OwnerStack } from "./OwnerAvatar";
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
    <div className="flex items-center gap-2 text-label">
      <span className="w-20 shrink-0 text-text-tertiary">{label}</span>
      {emails.length ? <OwnerStack emails={emails} size={18} /> : <span className="italic text-text-tertiary">{raw ?? "unassigned"}</span>}
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
    <div className="flex h-full flex-col bg-bg-surface text-text-primary">
      <div className="flex items-start justify-between gap-3 border-b border-border-subtle p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-label uppercase tracking-[0.04em] text-text-tertiary">
            <span className="font-mono">#{row.id}</span>
            <TypeBadge type={row.type} />
            {row.release && <span className="rounded-sm bg-bg-muted px-1.5 py-0.5">{row.release}</span>}
            <span className="font-mono">Rank {row.rank_score ?? "no rank"}</span>
          </div>
          <h2 className="mt-1.5 font-serif text-[22px] font-medium leading-tight tracking-[-0.015em] text-text-primary">{row.name}</h2>
          <div className="mt-2 flex items-center gap-3 text-label">
            <span className="inline-flex items-center gap-1.5">
              <StatusDot status={row.status} />
              <span className="text-text-secondary">{row.status}</span>
            </span>
            {row.due_date && <span className="text-text-tertiary">Due {formatDateShort(row.due_date)}</span>}
            {row.is_ready === true && (
              <span className="rounded-sm bg-status-ready-soft px-1.5 py-0.5 text-badge text-status-ready-text">Ready</span>
            )}
          </div>
        </div>
        <a
          href={sheetDeepLink(row.sheet_row)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-label text-text-secondary hover:bg-bg-muted"
        >
          Open in Sheet <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 scrollbar-thin">
        <Section title="People">
          {ownerLine("Responsible", row.r_emails, row.r_raw)}
          {ownerLine("Accountable", row.a_emails, row.a_raw)}
          {ownerLine("Definer", row.d_emails, row.d_raw)}
        </Section>

        <Section title="Metadata">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <Field label="Category" value={row.category} />
            <Field label="Subsystem" value={row.subsystem} />
            <Field label="Priority" value={row.priority?.toString()} />
            <Field label="Impact" value={row.impact?.toString()} />
            <Field label="Difficulty" value={row.difficulty?.toString()} />
            <Field label="Rank Score" value={row.rank_score?.toString()} />
            <Field label="Due Date" value={formatDateShort(row.due_date)} />
            <Field label="Blocked Since" value={formatDateShort(row.blocked_since)} />
          </div>
        </Section>

        {row.blocker || row.blocked_since ? (
          <Section title="Block">
            <div className="rounded-md border border-border-subtle bg-status-blocked-soft p-3 text-compact text-text-secondary">
              <div>{row.blocker ?? "unassigned"}</div>
              {row.blocked_since && (
                <div className="mt-1 text-status-blocked-text">
                  Blocked since {formatDateShort(row.blocked_since)} · stuck {daysSince(row.blocked_since)}d
                </div>
              )}
            </div>
          </Section>
        ) : null}

        {row.links.length > 0 && (
          <Section title="Links">
            <div className="flex flex-wrap gap-1.5">
              {row.links.map((l) => {
                const href = l.type === "jira_prmt" || l.type === "jira_inv" ? jiraLink(l.id) : "#";
                return (
                  <a
                    key={l.raw}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-border-subtle bg-bg-muted px-2 py-0.5 text-label text-text-secondary hover:bg-bg-inset"
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
                <div key={e.key} className="rounded-md border border-border-subtle bg-bg-surface p-2 text-compact">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-text-tertiary">{e.key}</span>
                    <StatusDot status={e.status} />
                    <span className="text-text-secondary">{e.status}</span>
                  </div>
                  {e.experiment && <div className="mt-0.5 text-text-primary">{e.experiment}</div>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {parent && (
          <Section title="Parent">
            <Link href={`/item/${parent.id}`} prefetch={false} className="block rounded-md border border-border-subtle bg-bg-surface p-2 text-compact hover:bg-bg-muted">
              <span className="font-mono text-text-tertiary">#{parent.id}</span> <span className="text-text-primary">{parent.name}</span>
            </Link>
          </Section>
        )}

        {children.length > 0 && (
          <Section title={`Children (${children.length})`}>
            <div className="space-y-1.5">
              {children.map((c) => (
                <Link key={c.id} href={`/item/${c.id}`} prefetch={false} className="block rounded-md border border-border-subtle bg-bg-surface p-2 text-compact hover:bg-bg-muted">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-text-tertiary">#{c.id}</span>
                    <StatusDot status={c.status} />
                    <span className="text-text-primary">{c.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {row.dod && (
          <Section title="Definition of Done">
            <p className="whitespace-pre-wrap text-compact text-text-secondary">{row.dod}</p>
          </Section>
        )}

        {row.comments && (
          <Section title="Comments">
            <p className="whitespace-pre-wrap text-compact text-text-secondary">{row.comments}</p>
          </Section>
        )}

        <details className="rounded-md border border-border-subtle bg-bg-inset p-3">
          <summary className="cursor-pointer text-label text-text-secondary">Raw data</summary>
          <div className="mt-2 space-y-1 text-label text-text-tertiary">
            <Field label="status_raw" value={row.status_raw} mono />
            <Field label="r_raw" value={row.r_raw} mono />
            <Field label="a_raw" value={row.a_raw} mono />
            <Field label="d_raw" value={row.d_raw} mono />
          </div>
          <p className="mt-2 text-label text-text-tertiary">Spencer will normalize this.</p>
        </details>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-badge uppercase tracking-[0.04em] text-text-tertiary">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 text-label">
      <span className="w-20 shrink-0 text-text-tertiary">{label}</span>
      <span className={mono ? "font-mono text-text-secondary" : "text-text-secondary"}>{value ?? "—"}</span>
    </div>
  );
}
