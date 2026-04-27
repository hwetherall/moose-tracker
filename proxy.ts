import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
  const path = req.nextUrl.pathname;
  const isPublic =
    path.startsWith("/api/auth") ||
    path.startsWith("/api/health") ||
    path.startsWith("/api/cron") ||
    path.startsWith("/signin") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico";
  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    const url = new URL("/signin", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  const email = req.auth.user?.email ?? "";
  if (!email.toLowerCase().endsWith("@innovera.ai")) {
    return NextResponse.redirect(new URL("/signin?error=domain", req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
