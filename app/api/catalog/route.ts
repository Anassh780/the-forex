import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { listDriveFolders, listDriveFolderContents } from "@/lib/google-drive";
import { hasPlanFeature } from "@/lib/plan-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isVideo = (m?: string) => (m || "").startsWith("video/");
const isCourseCover = (name: string, mimeType?: string) =>
  /^(?:\d{2,3}\s*[·.\-–]\s*)?cover\b/i.test(name) && (mimeType || "").startsWith("image/");

// Member-facing, read-only view of the Drive content vault.
// GET /api/catalog          -> course folders (each folder = a course) with lesson counts,
//                              plus a synthetic "Uncategorized" course for loose root videos
// GET /api/catalog?id=<id>  -> the sequenced videos inside one course (or the root)
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await hasPlanFeature(session.user.role, "courses"))) {
    return NextResponse.json({ error: "Your current plan does not include course access." }, { status: 403 });
  }

  try {
    const id = new URL(request.url).searchParams.get("id");

    if (id) {
      const { files } = await listDriveFolderContents(id);
      // Videos are the lessons; strip the leading sequence prefix from display names.
      const videos = files
        .filter(f => isVideo(f.mimeType))
        .map((f, index) => ({
          id: f.id,
          index: index + 1,
          name: f.name.replace(/^(\d{2,3})\s*[·.\-–]\s*/, ""),
          durationMillis: f.videoMediaMetadata?.durationMillis || null,
          thumbnail: f.thumbnailLink || null,
        }));
      // Non-video, non-folder files are downloadable course resources (PDFs, etc.).
      const resources = files
        .filter(f => !isVideo(f.mimeType) && !isCourseCover(f.name, f.mimeType) && f.mimeType !== "application/vnd.google-apps.folder")
        .map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType }));
      return NextResponse.json({ videos, resources });
    }

    const { rootId, folders } = await listDriveFolders();

    // Count videos per course folder in parallel so cards can show lesson counts.
    const courses = await Promise.all(
      folders.map(async folder => {
        try {
          const { files } = await listDriveFolderContents(folder.id);
          const videos = files.filter(f => isVideo(f.mimeType));
          const coverFile = files
            .filter(f => isCourseCover(f.name, f.mimeType))
            .sort((a, b) => Date.parse(b.modifiedTime || "") - Date.parse(a.modifiedTime || ""))[0];
          const thumbnail = coverFile?.id || null;
          return { id: folder.id, name: folder.name, modifiedTime: folder.modifiedTime, videoCount: videos.length, thumbnail };
        } catch {
          return { id: folder.id, name: folder.name, modifiedTime: folder.modifiedTime, videoCount: 0, thumbnail: null };
        }
      }),
    );

    // Surface loose videos sitting directly in the content root so nothing is ever
    // hidden from members — they show up as an "Uncategorized" course.
    try {
      const { files } = await listDriveFolderContents(rootId);
      const looseVideos = files.filter(f => isVideo(f.mimeType)).length;
      if (looseVideos > 0) {
        courses.push({ id: rootId, name: "Uncategorized", modifiedTime: undefined, videoCount: looseVideos, thumbnail: null });
      }
    } catch {
      // Ignore root read failures — the named courses above are still returned.
    }

    return NextResponse.json({ courses });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unable to load the course catalog.";
    // A missing Drive connection is a configuration state, not a member error.
    const status = message.includes("Connect Google Drive") ? 503 : 502;
    return NextResponse.json({ error: message, courses: [], videos: [] }, { status });
  }
}
