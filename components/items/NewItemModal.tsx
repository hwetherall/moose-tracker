"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useSWRConfig } from "swr";
import { X } from "lucide-react";
import { CATEGORIES, SUBSYSTEMS, RELEASES_ORDER } from "@/lib/types";

const STATUSES = ["5-Backlog", "3-Discovery", "2-ReadyForDev"] as const;
const TYPES = ["Epic", "Story", "Task"] as const;

type Person = { email: string; display_name: string };
type Epic = { id: number; name: string };

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function NewItemModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: peopleData } = useSWR<{ people: Person[] }>(open ? "/api/people" : null, fetcher);
  const { data: epicsData } = useSWR<{ epics: Epic[] }>(open ? "/api/epics" : null, fetcher);

  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("Story");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("5-Backlog");
  const [category, setCategory] = useState<string>("");
  const [subsystem, setSubsystem] = useState<string>("");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [impact, setImpact] = useState<1 | 2 | 3>(2);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4>(2);
  const [release, setRelease] = useState<string>("");
  const [rEmails, setREmails] = useState<string[]>([]);
  const [aEmails, setAEmails] = useState<string[]>([]);
  const [dEmails, setDEmails] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string>("");
  const [dod, setDod] = useState<string>("");
  const [comments, setComments] = useState<string>("");
  const [parentEpic, setParentEpic] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rankScore = priority * 100 + impact * 10 + difficulty;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const validName = name.trim().length >= 3;
  const validCategory = category.length > 0;

  async function submit() {
    if (submitting) return;
    setError(null);
    if (!validName) {
      setError("Name must be at least 3 characters");
      return;
    }
    if (!validCategory) {
      setError("Category is required");
      return;
    }
    setSubmitting(true);
    window.dispatchEvent(new CustomEvent("moose:sync-pending", { detail: true }));
    try {
      const res = await fetch("/api/items/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          status,
          category,
          subsystem: subsystem || null,
          priority,
          impact,
          difficulty,
          release: release || null,
          r_emails: rEmails,
          a_emails: aEmails,
          d_emails: dEmails,
          due_date: dueDate || null,
          dod: dod || null,
          comments: comments || null,
          parent_epic: parentEpic || null
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Create failed (${res.status})`);
      }
      // Sync ran server-side; revalidate any SWR-keyed views and refresh server components.
      await mutate(() => true, undefined, { revalidate: true });
      router.refresh();
      onClose();
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
      window.dispatchEvent(new CustomEvent("moose:sync-pending", { detail: false }));
    }
  }

  function reset() {
    setName("");
    setType("Story");
    setStatus("5-Backlog");
    setCategory("");
    setSubsystem("");
    setPriority(2);
    setImpact(2);
    setDifficulty(2);
    setRelease("");
    setREmails([]);
    setAEmails([]);
    setDEmails([]);
    setDueDate("");
    setDod("");
    setComments("");
    setParentEpic("");
    setError(null);
  }

  const people = useMemo(() => peopleData?.people ?? [], [peopleData]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-full w-[480px] flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-xl">
        <header className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <h2 className="font-serif text-section text-text-primary">New item</h2>
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
            <input
              data-test-id="ni-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Add tooltip to By owner nav"
            />
          </Field>

          <Field label="Type" required>
            <Radios
              testId="ni-type"
              value={type}
              onChange={(v) => setType(v as typeof type)}
              options={TYPES.map((t) => ({ value: t, label: t }))}
            />
          </Field>

          <Field label="Status" required>
            <select
              data-test-id="ni-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className={inputClass}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Category" required>
            <select
              data-test-id="ni-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              <option value="">Select…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Subsystem">
            <select
              data-test-id="ni-subsystem"
              value={subsystem}
              onChange={(e) => setSubsystem(e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {SUBSYSTEMS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Priority">
              <Radios
                testId="ni-priority"
                value={String(priority)}
                onChange={(v) => setPriority(Number(v) as typeof priority)}
                options={["1", "2", "3"].map((v) => ({ value: v, label: v }))}
              />
            </Field>
            <Field label="Impact">
              <Radios
                testId="ni-impact"
                value={String(impact)}
                onChange={(v) => setImpact(Number(v) as typeof impact)}
                options={["1", "2", "3"].map((v) => ({ value: v, label: v }))}
              />
            </Field>
            <Field label="Difficulty">
              <Radios
                testId="ni-difficulty"
                value={String(difficulty)}
                onChange={(v) => setDifficulty(Number(v) as typeof difficulty)}
                options={["1", "2", "3", "4"].map((v) => ({ value: v, label: v }))}
              />
            </Field>
          </div>

          <div className="rounded-md border border-border-subtle bg-bg-muted px-3 py-2 text-label text-text-tertiary">
            Rank score:{" "}
            <span className="font-mono text-text-primary" data-test-id="ni-rank">
              {rankScore}
            </span>
            <span className="ml-2">(P×100 + I×10 + D)</span>
          </div>

          <Field label="Release">
            <select
              data-test-id="ni-release"
              value={release}
              onChange={(e) => setRelease(e.target.value)}
              className={inputClass}
            >
              <option value="">Unassigned</option>
              {RELEASES_ORDER.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>

          <PeopleMulti label="Responsible (R)" people={people} value={rEmails} onChange={setREmails} testId="ni-r" />
          <PeopleMulti label="Accountable (A)" people={people} value={aEmails} onChange={setAEmails} testId="ni-a" />
          <PeopleMulti label="Definer (D)" people={people} value={dEmails} onChange={setDEmails} testId="ni-d" />

          <Field label="Due date">
            <input
              data-test-id="ni-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Definition of Done">
            <textarea
              data-test-id="ni-dod"
              rows={3}
              value={dod}
              onChange={(e) => setDod(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Comments">
            <input
              data-test-id="ni-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Parent / Epic">
            <input
              data-test-id="ni-parent"
              value={parentEpic}
              onChange={(e) => setParentEpic(e.target.value)}
              list="epics-list"
              placeholder="search epics by name…"
              className={inputClass}
            />
            <datalist id="epics-list">
              {(epicsData?.epics ?? []).map((e) => (
                <option key={e.id} value={e.name} />
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
            data-test-id="ni-submit"
            onClick={submit}
            disabled={submitting || !validName || !validCategory}
            className="rounded-md bg-brand px-3 py-1.5 text-compact text-text-inverse hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Adding to Antler…" : "Add to Antler"}
          </button>
        </footer>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-compact text-text-primary focus:border-brand focus:outline-none";

function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
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

function Radios({
  value,
  onChange,
  options,
  testId
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  testId?: string;
}) {
  return (
    <div className="flex gap-1" data-test-id={testId}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={
            value === o.value
              ? "rounded-md border border-brand bg-brand-soft px-2.5 py-1 text-compact text-text-primary"
              : "rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1 text-compact text-text-secondary hover:border-border-medium"
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PeopleMulti({
  label,
  people,
  value,
  onChange,
  testId
}: {
  label: string;
  people: Person[];
  value: string[];
  onChange: (v: string[]) => void;
  testId?: string;
}) {
  function toggle(email: string) {
    onChange(value.includes(email) ? value.filter((e) => e !== email) : [...value, email]);
  }
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1" data-test-id={testId}>
        {people.length === 0 ? (
          <span className="text-label italic text-text-tertiary">loading…</span>
        ) : (
          people.map((p) => {
            const active = value.includes(p.email);
            return (
              <button
                key={p.email}
                type="button"
                onClick={() => toggle(p.email)}
                className={
                  active
                    ? "rounded-md border border-brand bg-brand-soft px-2 py-0.5 text-label text-text-primary"
                    : "rounded-md border border-border-subtle bg-bg-surface px-2 py-0.5 text-label text-text-secondary hover:border-border-medium"
                }
              >
                {p.display_name}
              </button>
            );
          })
        )}
      </div>
    </Field>
  );
}
