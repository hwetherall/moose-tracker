"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useEffect } from "react";

export function DrawerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="fixed inset-0 z-40">
      <button
        aria-label="Close"
        onClick={() => router.back()}
        className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-paper-line bg-paper shadow-xl">
        <button
          onClick={() => router.back()}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md border border-paper-line bg-paper text-ink-soft hover:bg-paper-mute"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </aside>
    </div>
  );
}
