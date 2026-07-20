import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

/** Exact public page paths (no auth cookie required). */
const publicExact = new Set(["/", "/login", "/signup", "/vip"]);

/** Prefixes that stay public for marketing + research browsing. */
const publicPrefixes = ["/strategies", "/api/auth", "/api/register", "/api/google-drive", "/api/gooo", "/api/strategies", "/api/plans"];

function isPublicPath(pathname: string) {
  if (publicExact.has(pathname)) return true;
  return publicPrefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|ico|svg)$).*)"],
};
