import { cn } from "@/lib/utils";

const MAP: Record<string, string> = {
  Epic: "bg-type-epic-soft text-type-epic-text",
  Story: "bg-type-story-soft text-type-story-text",
  Task: "bg-type-task-soft text-type-task-text"
};

export function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-badge font-medium",
        "border-transparent uppercase leading-none tracking-[0.02em]",
        MAP[type] ?? "bg-bg-muted text-text-secondary"
      )}
    >
      {type}
    </span>
  );
}
