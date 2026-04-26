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
  FlaskConical
} from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const items = [
  { href: "/",            label: "Overview",   icon: LayoutGrid, exact: true },
  { href: "/items",       label: "Items",      icon: List },
  { href: "/kanban",      label: "Kanban",     icon: Columns3 },
  { href: "/release",     label: "Release",    icon: Calendar },
  { href: "/blocked",     label: "Blocked",    icon: AlertCircle },
  { href: "/owners",      label: "Owners",     icon: Users },
  { href: "/subsystems",  label: "Subsystems", icon: Layers },
  { href: "/experiments", label: "Experiments", icon: FlaskConical }
];

export function SideNav() {
  const pathname = usePathname();
  const { data } = useSWR<{ count: number }>("/api/blocked-count", fetcher, { refreshInterval: 30_000 });
  return (
    <nav className="flex-1">
      <div className="mb-2 px-2 text-label uppercase tracking-[0.04em] text-text-tertiary">Views</div>
      <ul className="space-y-0.5">
        {items.map((it) => {
          const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
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
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
