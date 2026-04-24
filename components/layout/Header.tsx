import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { RefreshButton } from "@/components/refresh/RefreshButton";
import { GlobalSearch } from "@/components/search/GlobalSearch";

export function Header({
  user
}: {
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-paper-line bg-paper px-4 md:px-6">
      <Link href="/" className="flex items-center gap-2">
        <div className="h-6 w-6 rounded bg-brand" aria-hidden />
        <span className="text-sm font-semibold tracking-tight text-ink">Innovera / Moose</span>
      </Link>
      <div className="mx-2 h-6 w-px bg-paper-line" aria-hidden />
      <h1 className="hidden text-sm text-ink-mute md:block">Dashboard</h1>
      <div className="flex-1" />
      <GlobalSearch />
      <RefreshButton />
      {user ? (
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-ink-mute md:inline">{user.email}</span>
          <SignOutButton />
        </div>
      ) : null}
    </header>
  );
}
