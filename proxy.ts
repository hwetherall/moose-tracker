import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PASSWORD = 'k9v4q2KfEnja';
const PASSWORD_COOKIE = 'antler-password';

export const proxy = auth((req) => {
  const path = req.nextUrl.pathname;
  const isPublic =
    path.startsWith("/api/auth") ||
    path.startsWith("/api/health") ||
    path.startsWith("/api/cron") ||
    path.startsWith("/api/password") ||
    path.startsWith("/signin") ||
    path.startsWith("/password") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico";
  if (isPublic) return NextResponse.next();

  const passwordCookie = req.cookies.get(PASSWORD_COOKIE);
  const hasValidPassword = passwordCookie?.value === PASSWORD;

  if (!hasValidPassword) {
    return NextResponse.redirect(new URL("/password", req.nextUrl.origin));
  }

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
