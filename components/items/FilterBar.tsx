"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

type Opt = { value: string; label?: string };

export function FilterBar({
  statuses,
  types,
  releases,
  categories,
  subsystems,
  people
}: {
  statuses: string[];
  types: string[];
  releases: string[];
  categories: string[];
  subsystems: string[];
  people: { email: string; display_name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const current = (key: string): string[] => {
    const v = params.get(key);
    return v ? v.split(",").filter(Boolean) : [];
  };

  const setMulti = useCallback(
    (key: string, values: string[]) => {
      const next = new URLSearchParams(params.toString());
      if (values.length === 0) next.delete(key);
      else next.set(key, values.join(","));
      router.push(`${pathname}${next.toString() ? "?" + next.toString() : ""}`);
    },
    [params, pathname, router]
  );

  return (
    <div className="mb-4 flex flex-wrap gap-2 border-b border-border-subtle pb-3">
      <Select label="Status" options={statuses.map((s) => ({ value: s }))} selected={current("status")} onChange={(v) => setMulti("status", v)} />
      <Select label="Type" options={types.map((s) => ({ value: s }))} selected={current("type")} onChange={(v) => setMulti("type", v)} />
      <Select label="Release" options={releases.map((s) => ({ value: s }))} selected={current("release")} onChange={(v) => setMulti("release", v)} />
      <Select label="Category" options={categories.map((s) => ({ value: s }))} selected={current("category")} onChange={(v) => setMulti("category", v)} />
      <Select label="Subsystem" options={subsystems.map((s) => ({ value: s }))} selected={current("subsystem")} onChange={(v) => setMulti("subsystem", v)} />
      <Select
        label="Owner"
        options={people.map((p) => ({ value: p.email, label: p.display_name }))}
        selected={current("owner")}
        onChange={(v) => setMulti("owner", v)}
      />
      {(current("status").length ||
        current("type").length ||
        current("release").length ||
        current("category").length ||
        current("subsystem").length ||
        current("owner").length) > 0 ? (
        <button
          className="ml-auto rounded-md bg-bg-muted px-2.5 py-1 text-label text-text-secondary hover:bg-bg-inset"
          onClick={() => router.push(pathname)}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

function Select({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: Opt[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer select-none list-none rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1 text-label text-text-secondary hover:bg-bg-muted">
        {label}
        {selected.length > 0 && <span className="ml-1 rounded-sm bg-brand-soft px-1 text-brand">{selected.length}</span>}
      </summary>
      <div className="absolute z-20 mt-1 max-h-72 w-56 overflow-auto rounded-md border border-border-subtle bg-bg-surface p-1 shadow-sm">
        {options.length === 0 && <div className="px-2 py-1 text-label text-text-tertiary">No options</div>}
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-label text-text-secondary hover:bg-bg-muted">
              <input
                type="checkbox"
                checked={on}
                onChange={() => {
                  const next = on ? selected.filter((s) => s !== o.value) : [...selected, o.value];
                  onChange(next);
                }}
              />
              <span className="truncate">{o.label ?? o.value}</span>
            </label>
          );
        })}
      </div>
    </details>
  );
}
