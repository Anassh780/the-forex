import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { createDriveFolder, listDriveFolders, listDriveFolderContents } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "Authentication required.", status: 401 as const };
  if ((session.user as { role?: string }).role !== "admin") return { error: "Administrator access required.", status: 403 as const };
  return null;
}

// GET /api/drive/folders            -> list course folders under the content root
// GET /api/drive/folders?id=<id>    -> list the contents of one folder
export async function GET(request: Request) {
  const blocked = await requireAdmin();
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id) return NextResponse.json(await listDriveFolderContents(id));
    return NextResponse.json(await listDriveFolders());
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unable to load Drive folders.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// POST /api/drive/folders  { name, parentId? }  -> create a course folder
export async function POST(request: Request) {
  const blocked = await requireAdmin();
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });
  try {
    const { name, parentId } = await request.json() as { name?: string; parentId?: string };
    const clean = name?.trim();
    if (!clean) return NextResponse.json({ error: "Enter a folder name." }, { status: 400 });
    const folder = await createDriveFolder(clean, parentId);
    return NextResponse.json({ ok: true, folder }, { status: 201 });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unable to create folder.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
