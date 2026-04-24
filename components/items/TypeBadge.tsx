import { cn } from "@/lib/utils";

const MAP: Record<string, string> = {
  Epic: "bg-violet-100 text-violet-800 border-violet-200",
  Story: "bg-blue-100 text-blue-800 border-blue-200",
  Task: "bg-slate-100 text-slate-700 border-slate-200"
};

export function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium",
        MAP[type] ?? "bg-paper-mute text-ink-soft border-paper-line"
      )}
    >
      {type}
    </span>
  );
}
