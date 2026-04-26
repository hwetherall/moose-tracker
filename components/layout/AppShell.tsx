import { Header } from "./Header";
import { SideNav } from "./SideNav";
import { LastSyncedFooter } from "./LastSyncedFooter";
import { SyncBanner } from "./SyncBanner";

export function AppShell({
  children,
  user
}: {
  children: React.ReactNode;
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
}) {
  return (
    <div className="flex min-h-screen bg-bg-page text-text-primary">
      <aside className="hidden w-[200px] shrink-0 flex-col border-r border-border-subtle bg-bg-muted px-3.5 py-5 md:flex">
        <div className="mb-8 flex items-center gap-2 px-1">
          <div className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-brand font-medium text-text-inverse">
            M
          </div>
          <span className="font-serif text-[15px] font-medium text-text-primary">Moose</span>
        </div>
          <SideNav />
          <LastSyncedFooter />
      </aside>
      <main className="min-w-0 flex-1 bg-bg-page">
        <SyncBanner />
        <Header user={user} />
        <div className="px-5 py-7 md:px-9">{children}</div>
      </main>
    </div>
  );
}
