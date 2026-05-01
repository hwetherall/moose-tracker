"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useSWRConfig } from "swr";
import { Pencil, Save, X } from "lucide-react";
import type { Row } from "@/lib/queries/planning";
import { CATEGORIES, RELEASES_ORDER, STATUSES, SUBSYSTEMS, TYPES } from "@/lib/types";

type Person = { email: string; display_name: string };
type Epic = { id: number; name: string };

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const inputClass =
  "w-full rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-compact text-text-primary focus:border-brand focus:outline-none";

export function EditItemButton({ row, brief }: { row: Row; brief?: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-label text-text-secondary hover:bg-bg-muted"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </button>
      {open && <EditItemModal row={row} brief={brief ?? null} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditItemModal({ row, brief: initialBrief, onClose }: { row: Row; brief: string | null; onClose: () => void }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: peopleData } = useSWR<{ people: Person[] }>("/api/people", fetcher);
  const { data: epicsData } = useSWR<{ epics: Epic[] }>("/api/epics", fetcher);

  const [name, setName] = useState(row.name);
  const [release, setRelease] = useState(row.release ?? "");
  const [seq, setSeq] = useState(row.seq ?? "");
  const [status, setStatus] = useState(row.status);
  const [type, setType] = useState(row.type ?? "");
  const [category, setCategory] = useState(row.category ?? "");
  const [subsystem, setSubsystem] = useState(row.subsystem ?? "");
  const [parentEpic, setParentEpic] = useState(row.parent_epic ?? "");
  const [priority, setPriority] = useState(row.priority?.toString() ?? "");
  const [impact, setImpact] = useState(row.impact?.toString() ?? "");
  const [difficulty, setDifficulty] = useState(row.difficulty?.toString() ?? "");
  const [rEmails, setREmails] = useState<string[]>(row.r_emails);
  const [aEmails, setAEmails] = useState<string[]>(row.a_emails);
  const [dEmails, setDEmails] = useState<string[]>(row.d_emails);
  const [dueDate, setDueDate] = useState(row.due_date ?? "");
  const [comments, setComments] = useState(row.comments ?? "");
  const [dod, setDod] = useState(row.dod ?? "");
  const [blocker, setBlocker] = useState(row.blocker ?? "");
  const [blockedSince, setBlockedSince] = useState(row.blocked_since ?? "");
  const [brief, setBrief] = useState(initialBrief ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const people = useMemo(() => peopleData?.people ?? [], [peopleData]);
  const valid = name.trim().length >= 3 && category.trim().length > 0;
  const rankScore =
    priority && impact && difficulty ? Number(priority) * 100 + Number(impact) * 10 + Number(difficulty) : null;

  async function submit() {
    if (saving || !valid) return;
    setSaving(true);
    setError(null);
    window.dispatchEvent(new CustomEvent("moose:sync-pending", { detail: true }));
    try {
      const res = await fetch(`/api/items/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          release: release || null,
          seq: seq || null,
          status,
          type: type || null,
          category: category.trim(),
          subsystem: subsystem || null,
          parent_epic: parentEpic || null,
          priority: priority ? Number(priority) : null,
          impact: impact ? Number(impact) : null,
          difficulty: difficulty ? Number(difficulty) : null,
          r_emails: rEmails,
          a_emails: aEmails,
          d_emails: dEmails,
          due_date: dueDate || null,
          comments: comments || null,
          dod: dod || null,
          blocker: blocker || null,
          blocked_since: blockedSince || null,
          ai_brief_from_sheet: brief || null
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? `Update failed (${res.status})`);
      await mutate(() => true, undefined, { revalidate: true });
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update item");
    } finally {
      setSaving(false);
      window.dispatchEvent(new CustomEvent("moose:sync-pending", { detail: false }));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-full w-[560px] flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-xl">
        <header className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <div className="min-w-0">
            <div className="font-mono text-label text-text-tertiary">#{row.id}</div>
            <h2 className="font-serif text-section text-text-primary">Edit item</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-tertiary hover:bg-bg-muted hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 scrollbar-thin">
          <Field label="Name" required>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                <option value="">--</option>
                {TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status" required>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" required>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {ensureOption(CATEGORIES, category).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Subsystem">
              <select value={subsystem} onChange={(e) => setSubsystem(e.target.value)} className={inputClass}>
                <option value="">--</option>
                {ensureOption(SUBSYSTEMS, subsystem).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Release">
              <select value={release} onChange={(e) => setRelease(e.target.value)} className={inputClass}>
                <option value="">Unassigned</option>
                {ensureOption(RELEASES_ORDER, release).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Seq">
              <input value={seq} onChange={(e) => setSeq(e.target.value)} className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Priority">
              <NumberSelect value={priority} onChange={setPriority} max={3} />
            </Field>
            <Field label="Impact">
              <NumberSelect value={impact} onChange={setImpact} max={3} />
            </Field>
            <Field label="Difficulty">
              <NumberSelect value={difficulty} onChange={setDifficulty} max={4} />
            </Field>
          </div>

          <div className="rounded-md border border-border-subtle bg-bg-muted px-3 py-2 text-label text-text-tertiary">
            Rank score: <span className="font-mono text-text-primary">{rankScore ?? "--"}</span>
          </div>

          <PeopleMulti label="Responsible (R)" people={people} value={rEmails} onChange={setREmails} />
          <PeopleMulti label="Accountable (A)" people={people} value={aEmails} onChange={setAEmails} />
          <PeopleMulti label="Definer (D)" people={people} value={dEmails} onChange={setDEmails} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Blocked since">
              <input
                type="date"
                value={blockedSince}
                onChange={(e) => setBlockedSince(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Blocker">
            <input value={blocker} onChange={(e) => setBlocker(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Definition of Done">
            <textarea value={dod} onChange={(e) => setDod(e.target.value)} rows={3} className={inputClass} />
          </Field>

          <Field label="Comments">
            <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} className={inputClass} />
          </Field>

          <Field label="AI Brief">
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} className={inputClass} />
          </Field>

          <Field label="Parent / Epic">
            <input
              value={parentEpic}
              onChange={(e) => setParentEpic(e.target.value)}
              list={`edit-epics-${row.id}`}
              className={inputClass}
            />
            <datalist id={`edit-epics-${row.id}`}>
              {(epicsData?.epics ?? []).map((epic) => (
                <option key={epic.id} value={epic.name} />
              ))}
            </datalist>
          </Field>

          {error && (
            <div className="rounded-md border border-status-blocked-soft bg-status-blocked-soft px-3 py-2 text-compact text-status-blocked-text">
              {error}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border-subtle bg-bg-page px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-compact text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !valid}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-compact text-text-inverse hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-label text-text-tertiary">
        {label}
        {required && <span className="text-status-blocked-text"> *</span>}
      </span>
      {children}
    </label>
  );
}

function NumberSelect({
  value,
  onChange,
  max
}: {
  value: string;
  onChange: (value: string) => void;
  max: 3 | 4;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">--</option>
      {Array.from({ length: max }, (_, index) => String(index + 1)).map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function PeopleMulti({
  label,
  people,
  value,
  onChange
}: {
  label: string;
  people: Person[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  function toggle(email: string) {
    onChange(value.includes(email) ? value.filter((item) => item !== email) : [...value, email]);
  }

  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1">
        {people.length === 0 ? (
          <span className="text-label italic text-text-tertiary">loading...</span>
        ) : (
          people.map((person) => {
            const active = value.includes(person.email);
            return (
              <button
                key={person.email}
                type="button"
                onClick={() => toggle(person.email)}
                className={
                  active
                    ? "rounded-md border border-brand bg-brand-soft px-2 py-0.5 text-label text-text-primary"
                    : "rounded-md border border-border-subtle bg-bg-surface px-2 py-0.5 text-label text-text-secondary hover:border-border-medium"
                }
              >
                {person.display_name}
              </button>
            );
          })
        )}
      </div>
    </Field>
  );
}

function ensureOption(options: readonly string[], current: string): string[] {
  if (!current || options.includes(current)) return [...options];
  return [current, ...options];
}
