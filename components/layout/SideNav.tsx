"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  List,
  KanbanSquare,
  CalendarDays,
  AlertCircle,
  Users,
  Layers,
  FlaskConical
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/",            label: "Overview",   icon: LayoutDashboard, exact: true },
  { href: "/items",       label: "Items",      icon: List },
  { href: "/kanban",      label: "Kanban",     icon: KanbanSquare },
  { href: "/release",     label: "Release",    icon: CalendarDays },
  { href: "/blocked",     label: "Blocked",    icon: AlertCircle },
  { href: "/owners",      label: "Owners",     icon: Users },
  { href: "/subsystems",  label: "Subsystems", icon: Layers },
  { href: "/experiments", label: "Experiments", icon: FlaskConical }
];

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 p-3">
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
                    ? "bg-brand-soft text-brand"
                    : "text-ink-soft hover:bg-paper-mute hover:text-ink"
                )}
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
