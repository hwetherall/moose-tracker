import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { auth } from "@/lib/auth";
import { Providers } from "@/components/theme/Providers";
import { themeCssVariables } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap"
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-fraunces",
  display: "swap"
});

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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCssVariables() }} />
      </head>
      <body className="min-h-screen bg-bg-page font-sans text-body text-text-primary">
        <Providers>
          {session?.user ? (
            <>
              <AppShell user={session.user}>{children}</AppShell>
              {drawer}
            </>
          ) : (
            children
          )}
        </Providers>
      </body>
    </html>
  );
}
