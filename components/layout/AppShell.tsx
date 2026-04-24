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
    <div className="flex min-h-screen flex-col">
      <Header user={user} />
      <SyncBanner />
      <div className="flex flex-1">
        <aside className="hidden md:flex w-56 flex-col border-r border-paper-line bg-paper">
          <SideNav />
          <LastSyncedFooter />
        </aside>
        <main className="flex-1 min-w-0 bg-paper-soft">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
