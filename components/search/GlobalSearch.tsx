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
      className="hidden md:flex items-center gap-1.5 rounded-md border border-paper-line bg-paper-soft px-2 py-1.5 w-64"
    >
      <Search className="h-3.5 w-3.5 text-ink-mute" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search items…"
        className="flex-1 bg-transparent text-xs outline-none placeholder:text-ink-mute"
      />
    </form>
  );
}
