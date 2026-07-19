import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDriveFileMeta, streamDriveFile } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { fileId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const fileId = params.fileId;
  if (!fileId) return NextResponse.json({ error: "Missing file id." }, { status: 400 });

  try {
    const meta = await getDriveFileMeta(fileId);
    const upstream = await streamDriveFile(fileId);

    const headers = new Headers();
    headers.set("Content-Type", meta.mimeType || "image/png");
    headers.set("Cache-Control", "private, max-age=3600");
    headers.set("Content-Disposition", "inline");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unable to load image.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
