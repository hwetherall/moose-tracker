"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/items": "Items",
  "/kanban": "Kanban",
  "/release": "Release",
  "/blocked": "Blocked",
  "/owners": "By owner",
  "/subsystems": "By subsystem",
  "/experiments": "Experiments"
};

export function HeaderTitle() {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? (pathname.startsWith("/item/") ? "Item" : "Dashboard");
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date());

  return (
    <div>
      <div className="text-label uppercase tracking-[0.04em] text-text-tertiary">Innovera</div>
      <h1 className="font-serif text-page text-text-primary">{title}</h1>
      <p className="mt-1 text-body text-text-secondary">{date} · Moose tracker cache</p>
    </div>
  );
}
