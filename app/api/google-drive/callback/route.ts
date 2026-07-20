import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { authSecret } from "@/lib/env";
import { completeGoogleOAuth, parseGoogleState, roleForEmail } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export async function GET(request: Request) {
  const current = new URL(request.url);
  const code = current.searchParams.get("code");
  const error = current.searchParams.get("error");
  let pendingState: ReturnType<typeof parseGoogleState> | null = null;
  try {
    pendingState = parseGoogleState(current.searchParams.get("state"));
  } catch {
    // The verified state is required below; keeping this null provides a safe login fallback.
  }
  const errorDestination = (message: string) => pendingState?.mode === "drive"
    ? new URL(`/admin-ui?driveError=${encodeURIComponent(message)}`, current.origin)
    : new URL(`/login?error=${encodeURIComponent(message)}`, current.origin);

  if (error) return NextResponse.redirect(errorDestination(error));
  if (!code) return NextResponse.redirect(errorDestination("missing_google_code"));

  try {
    const state = pendingState || parseGoogleState(current.searchParams.get("state"));
    const profile = await completeGoogleOAuth(code, state.mode === "drive", current.origin);
    const email = profile.email?.toLowerCase();
    if (!email) {
      return NextResponse.redirect(new URL("/login?error=google_email_required", current.origin));
    }

    const role = roleForEmail(email);

    // Ensure a real User row exists so purchases, progress, and APIs that key off user.id work.
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
          role,
        },
      });
    } else if (user.role !== role && role === "admin") {
      // Promote known admin emails without demoting existing elevated roles.
      user = await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
    }

    const token = await encode({
      secret: authSecret(),
      maxAge: SESSION_MAX_AGE,
      token: {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: profile.name || user.email.split("@")[0],
        role: user.role,
      },
    });

    const destination =
      state.callbackUrl ||
      (state.mode === "drive" ? "/admin-ui?drive=connected" : user.role === "admin" ? "/admin-ui" : "/dashboard");

    const response = NextResponse.redirect(new URL(destination, current.origin));
    const secure = process.env.NEXTAUTH_URL?.startsWith("https://");
    response.cookies.set(secure ? "__Secure-next-auth.session-token" : "next-auth.session-token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: Boolean(secure),
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Google connection failed.";
    return NextResponse.redirect(errorDestination(message));
  }
}
