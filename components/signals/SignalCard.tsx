import Link from "next/link";
import { AlertCircle, Info, TrendingDown } from "lucide-react";
import type { Signal } from "@/lib/signals";

const ICON_MAP = {
  warning: AlertCircle,
  observation: Info,
  info: TrendingDown
} as const;

const ACCENT_BG = {
  warning: "bg-status-blocked",
  observation: "bg-status-discovery",
  info: "bg-status-indev"
} as const;

const ACCENT_TEXT = {
  warning: "text-status-blocked-text",
  observation: "text-status-discovery-text",
  info: "text-status-indev-text"
} as const;

export function SignalCard({ signal }: { signal: Signal }) {
  const Icon = ICON_MAP[signal.severity];
  return (
    <div
      data-test-id={`signal-${signal.id}`}
      className="relative flex flex-col gap-1.5 rounded-lg rounded-l-none border border-border-subtle bg-bg-surface px-4 py-3 pl-[14px]"
    >
      <span
        aria-hidden
        className={`absolute left-0 top-0 h-full w-[2px] ${ACCENT_BG[signal.severity]}`}
      />
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${ACCENT_TEXT[signal.severity]}`} aria-hidden />
        <h3 className="font-serif text-[14px] font-medium leading-none text-text-primary">
          {signal.title}
        </h3>
      </div>
      <p className="text-compact text-text-secondary">{signal.body}</p>
      {signal.actionLabel && signal.actionHref && (
        <Link
          href={signal.actionHref}
          prefetch={false}
          className="mt-0.5 inline-flex w-fit items-center text-label text-text-secondary hover:text-text-primary"
        >
          {signal.actionLabel} →
        </Link>
      )}
    </div>
  );
}
