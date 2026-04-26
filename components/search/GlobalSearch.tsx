"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        if (!query) return;
        router.push(`/items?q=${encodeURIComponent(query)}`);
      }}
      className="hidden w-[200px] items-center gap-1.5 rounded-md border border-border-subtle bg-bg-muted px-2 py-1.5 focus-within:border-brand md:flex"
    >
      <Search className="h-3.5 w-3.5 text-text-tertiary" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search items…"
        className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-tertiary"
      />
    </form>
  );
}
