import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { googleAuthUrl } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "drive" ? "drive" : "login";
  const callbackUrl = url.searchParams.get("callbackUrl") || undefined;
  try {
    if (mode === "drive") {
      const session = await getServerSession(authOptions);
      if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
      if (session.user.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }
    return NextResponse.redirect(googleAuthUrl(mode, callbackUrl));
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Google is not configured.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
