import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDriveFileMeta, streamDriveFile } from "@/lib/google-drive";
import { verifyStreamToken } from "@/lib/stream-token";
import { logInvalidStreamAttempt, logVideoAccess, requireActiveAccount } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams a Google Drive video through the site. Two gates protect it:
//   1. A valid NextAuth session (cookie) — blocks anonymous access.
//   2. A short-lived, session-bound, single-file token (?t=) minted by
//      /api/drive/stream-token — blocks copied URLs and download extensions,
//      which cannot mint a token and get a URL that expires in minutes.
// The raw Drive URL is never exposed to the browser.
export async function GET(request: Request, { params }: { params: { fileId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const fileId = params.fileId;
  if (!fileId) return NextResponse.json({ error: "Missing file id." }, { status: 400 });

  const userKey = (session.user as { id?: string; email?: string }).id || session.user.email || "member";
  if (!session.user.id) return NextResponse.json({ error: "Account identity is unavailable." }, { status: 403 });
  try {
    await requireActiveAccount(session.user.id);
  } catch (reason) {
    return NextResponse.json({ error: reason instanceof Error && reason.message === "ACCOUNT_SUSPENDED" ? "This account is suspended." : "Account unavailable." }, { status: 403 });
  }
  const token = new URL(request.url).searchParams.get("t");
  if (!verifyStreamToken(token, fileId, userKey)) {
    await logInvalidStreamAttempt(request, session.user.id, fileId);
    return NextResponse.json({ error: "This video link has expired. Reload the page to keep watching." }, { status: 403 });
  }

  try {
    const meta = await getDriveFileMeta(fileId);
    const range = request.headers.get("range");
    await logVideoAccess(request, session.user.id, fileId, "stream");
    const upstream = await streamDriveFile(fileId, range);

    const headers = new Headers();
    // Generic content type + attachment-forbidding headers make the response
    // look like an opaque stream rather than a saveable media file.
    headers.set("Content-Type", meta.mimeType || "video/mp4");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    headers.set("Content-Disposition", "inline");
    headers.set("X-Content-Type-Options", "nosniff");
    const contentRange = upstream.headers.get("content-range");
    const contentLength = upstream.headers.get("content-length");
    if (contentRange) headers.set("Content-Range", contentRange);
    if (contentLength) headers.set("Content-Length", contentLength);

    return new NextResponse(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unable to stream this file.";
    const status = message.includes("Connect Google Drive") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
