import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { createFirebaseUploadSession } from "@/lib/firebase-storage";
import { createGoogleDriveUploadSession } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  try {
    const data = await request.json() as { provider?: string; fileName?: string; fileSize?: number; contentType?: string; parentId?: string; preserveName?: boolean };
    if (!data.fileName || !data.fileSize) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    const upload = data.provider === "google-drive"
      ? await createGoogleDriveUploadSession({ fileName: data.fileName, fileSize: data.fileSize, contentType: data.contentType, parentId: data.parentId, preserveName: data.preserveName })
      : await createFirebaseUploadSession({ fileName: data.fileName, fileSize: data.fileSize, contentType: data.contentType });
    return NextResponse.json({ ok: true, upload });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Upload failed.";
    const status = message.includes("not configured") || message.startsWith("Connect Google Drive") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
