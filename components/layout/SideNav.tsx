"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  List,
  Columns3,
  Calendar,
  AlertCircle,
  Users,
  Layers,
  FlaskConical,
  Sparkles,
  Inbox
} from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const items = [
  { href: "/",            label: "Overview",   icon: LayoutGrid, exact: true },
  { href: "/inbox",       label: "Inbox",      icon: Inbox },
  { href: "/signals",     label: "Signals",    icon: Sparkles },
  { href: "/items",       label: "Items",      icon: List },
  { href: "/kanban",      label: "Kanban",     icon: Columns3 },
  { href: "/release",     label: "Release",    icon: Calendar },
  { href: "/blocked",     label: "Blocked",    icon: AlertCircle },
  { href: "/owners",      label: "Owners",     icon: Users },
  { href: "/subsystems",  label: "Subsystems", icon: Layers },
  { href: "/experiments", label: "Experiments", icon: FlaskConical }
];

type OwnerLoad = { email: string; display_name: string; count: number };

export function SideNav() {
  const pathname = usePathname();
  const { data } = useSWR<{ count: number }>("/api/blocked-count", fetcher, { refreshInterval: 30_000 });
  const { data: ownerLoad } = useSWR<{ owners: OwnerLoad[] }>("/api/owner-load", fetcher, {
    refreshInterval: 60_000
  });
  const { data: proposalCount } = useSWR<{ count: number }>("/api/agent/proposal-count", fetcher, {
    refreshInterval: 60_000
  });
  return (
    <nav className="flex-1">
      <div className="mb-2 px-2 text-label uppercase tracking-[0.04em] text-text-tertiary">Views</div>
      <ul className="space-y-0.5">
        {items.map((it) => {
          const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
          const Icon = it.icon;
          const isOwners = it.href === "/owners";
          const tooltip =
            isOwners && ownerLoad?.owners.length
              ? ownerLoad.owners
                  .slice(0, 3)
                  .map((o) => `${o.display_name} ${o.count}`)
                  .join("  ·  ")
              : undefined;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                title={tooltip}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-bg-surface text-text-primary"
                    : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {it.label}
                {it.href === "/blocked" && (
                  <span className="ml-auto rounded-lg bg-bg-inset px-1.5 text-label text-text-tertiary">{data?.count ?? 0}</span>
                )}
                {it.href === "/inbox" && proposalCount && proposalCount.count > 0 && (
                  <span className="ml-auto rounded-lg bg-brand-soft px-1.5 text-label text-brand">
                    {proposalCount.count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
