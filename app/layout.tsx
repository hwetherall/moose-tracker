import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Moose Dashboard",
  description: "Innovera Moose Tracker — read-only exec dashboard"
};

export default async function RootLayout({
  children,
  drawer
}: {
  children: React.ReactNode;
  drawer: React.ReactNode;
}) {
  const session = await auth();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <AppShell user={session?.user ?? null}>{children}</AppShell>
        {drawer}
      </body>
    </html>
  );
}
