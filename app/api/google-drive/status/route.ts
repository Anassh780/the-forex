import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { disconnectGoogleDrive, googleDriveStatus } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function forbidden(session: Session | null) {
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const blocked = forbidden(session);
  if (blocked) return blocked;
  return NextResponse.json({ provider: "google-drive", ...(await googleDriveStatus()) });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const blocked = forbidden(session);
  if (blocked) return blocked;
  await disconnectGoogleDrive();
  return NextResponse.json({ ok: true });
}
