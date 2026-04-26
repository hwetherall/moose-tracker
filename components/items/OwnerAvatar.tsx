import { displayNameForEmail } from "@/lib/people";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-status-done-soft text-status-done-text",
  "bg-status-indev-soft text-status-indev-text",
  "bg-status-ready-soft text-status-ready-text",
  "bg-status-discovery-soft text-status-discovery-text",
  "bg-status-experiment-soft text-status-experiment-text",
  "bg-status-backlog-soft text-status-backlog-text",
  "bg-status-blocked-soft text-status-blocked-text",
  "bg-type-story-soft text-type-story-text"
];

const SIZE = {
  16: "h-4 w-4 text-[9px]",
  18: "h-[18px] w-[18px] text-badge",
  22: "h-[22px] w-[22px] text-label",
  28: "h-7 w-7 text-body"
};

export function OwnerAvatar({
  email,
  size = 18,
  showName = false,
  className
}: {
  email: string;
  size?: 16 | 18 | 22 | 28;
  showName?: boolean;
  className?: string;
}) {
  const name = displayNameForEmail(email);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        title={name}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full font-medium leading-none",
          PALETTE[hash(email) % PALETTE.length],
          SIZE[size]
        )}
      >
        {name.charAt(0).toUpperCase()}
      </span>
      {showName && <span className="text-label text-text-secondary">{name}</span>}
    </span>
  );
}

export function OwnerStack({ emails, size = 18 }: { emails: string[]; size?: 16 | 18 | 22 | 28 }) {
  if (!emails.length) return <span className="text-label italic text-text-tertiary">unassigned</span>;
  const visible = emails.slice(0, 3);
  const names = emails.map(displayNameForEmail).join(", ");
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="flex shrink-0 items-center">
        {visible.map((email, index) => (
          <OwnerAvatar key={email} email={email} size={size} className={index > 0 ? "-ml-1" : undefined} />
        ))}
        {emails.length > 3 && (
          <span className="-ml-1 inline-flex h-[18px] items-center rounded-full bg-bg-inset px-1 text-badge text-text-tertiary">
            +{emails.length - 3}
          </span>
        )}
      </span>
      <span className="truncate text-label text-text-secondary">{names}</span>
    </span>
  );
}

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}
