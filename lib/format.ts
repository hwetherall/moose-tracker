import { formatDistanceToNowStrict, format, differenceInCalendarDays } from "date-fns";

export function formatRelative(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDistanceToNowStrict(date)} ago`;
}

export function formatDateShort(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d");
}

export function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return differenceInCalendarDays(date, new Date());
}

export function daysSince(d: string | null | undefined): number | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return differenceInCalendarDays(new Date(), date);
}
