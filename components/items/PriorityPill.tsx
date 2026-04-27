import { cn } from "@/lib/utils";

type Priority = 1 | 2 | 3;

type Props = {
  priority: Priority | null;
  rankScore: number | null;
  size?: "default" | "compact";
};

const COLORS: Record<Priority, string> = {
  1: "bg-priority-p1-bg text-priority-p1-text",
  2: "bg-priority-p2-bg text-priority-p2-text",
  3: "border-[0.5px] border-border-subtle bg-priority-p3-bg text-priority-p3-text"
};

export function PriorityPill({ priority, rankScore, size = "default" }: Props) {
  const textSize = size === "compact" ? "text-[9px]" : "text-[10px]";
  const padding = size === "compact" ? "px-[5px] py-0" : "px-1.5 py-px";

  if (priority) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <span
          className={cn(
            "rounded-sm font-semibold uppercase leading-[1.2] tracking-[0.04em]",
            textSize,
            padding,
            COLORS[priority]
          )}
        >
          P{priority}
        </span>
        {rankScore !== null && <span className="font-mono text-label tabular-nums text-text-tertiary">{rankScore}</span>}
      </span>
    );
  }

  if (rankScore !== null) {
    return <span className="shrink-0 font-mono text-label tabular-nums text-text-tertiary">Rank {rankScore}</span>;
  }

  return <span className="shrink-0 text-label italic text-text-tertiary">no rank</span>;
}

export function priorityValue(priority: number | null): Priority | null {
  return priority === 1 || priority === 2 || priority === 3 ? priority : null;
}
