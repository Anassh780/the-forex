import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getFirebaseStorageStatus } from "@/lib/firebase-storage";
import { googleDriveStatus, listGoogleDriveFiles, type GoogleDriveFile } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const firebase = getFirebaseStorageStatus();
  const baseDrive = await googleDriveStatus();
  let drive: Awaited<ReturnType<typeof googleDriveStatus>> & { files: GoogleDriveFile[]; folderId: string | null; error?: string } = {
    ...baseDrive,
    files: [],
    folderId: null,
  };
  if (baseDrive.connected) {
    try {
      drive = await listGoogleDriveFiles();
    } catch (reason) {
      drive = { ...baseDrive, files: [], folderId: null, error: reason instanceof Error ? reason.message : "Unable to load Google Drive files." };
    }
  }
  return NextResponse.json({
    firebase: {
      provider: "firebase",
      configured: firebase.configured,
      connected: firebase.configured,
      missing: firebase.missing,
      bucket: firebase.bucket,
      folder: firebase.folder,
      maxUploadMb: firebase.maxUploadMb,
    },
    drive,
  });
}
