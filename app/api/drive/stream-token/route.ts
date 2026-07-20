import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { hasPlanFeature } from "@/lib/plan-access";
import { createStreamToken } from "@/lib/stream-token";
import { logVideoAccess, requireActiveAccount } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mints a short-lived, session-bound token for a single Drive file. The player
// fetches this (credentialed) right before playback; the token is the only way
// to reach the stream, so a copied stream URL is useless without a fresh one.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { fileId } = (await request.json().catch(() => ({}))) as { fileId?: string };
  if (!fileId) return NextResponse.json({ error: "Missing file id." }, { status: 400 });

  const userKey = (session.user as { id?: string; email?: string }).id || session.user.email || "member";
  if (!session.user.id) return NextResponse.json({ error: "Account identity is unavailable." }, { status: 403 });
  if (!(await hasPlanFeature(session.user.role, "courses"))) {
    return NextResponse.json({ error: "Your current plan does not include course access." }, { status: 403 });
  }
  try {
    await requireActiveAccount(session.user.id);
  } catch (reason) {
    return NextResponse.json({ error: reason instanceof Error && reason.message === "ACCOUNT_SUSPENDED" ? "This account is suspended." : "Account unavailable." }, { status: 403 });
  }
  await logVideoAccess(request, session.user.id, fileId, "token");
  const token = createStreamToken(fileId, userKey);
  return NextResponse.json({ token });
}
