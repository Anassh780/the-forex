import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getFirebaseStorageStatus } from "@/lib/firebase-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const status = getFirebaseStorageStatus();
  return NextResponse.json({
    provider: "firebase",
    configured: status.configured,
    connected: status.configured,
    missing: status.missing,
    bucket: status.bucket,
    folder: status.folder,
    maxUploadMb: status.maxUploadMb,
  });
}
