import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { RefreshButton } from "@/components/refresh/RefreshButton";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { HeaderTitle } from "./HeaderTitle";

export function Header({
  user
}: {
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
}) {
  return (
    <header className="border-b border-border-subtle bg-bg-page px-5 py-4 md:px-9">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <Link href="/" className="sr-only">Moose</Link>
          <HeaderTitle />
        </div>
        <div className="flex items-center gap-2">
          <GlobalSearch />
          <RefreshButton />
          {user?.email ? (
            <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface py-1 pl-1 pr-2">
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-brand text-label font-medium text-text-inverse">
                {(user.name ?? user.email).charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-label text-text-secondary md:inline">{(user.name ?? user.email.split("@")[0]).split(" ")[0].toLowerCase()}</span>
              <SignOutButton />
            </div>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
