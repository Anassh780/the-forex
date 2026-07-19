import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { deleteDriveItem, moveDriveItem, renameDriveItem } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "Authentication required.", status: 401 as const };
  if ((session.user as { role?: string }).role !== "admin") return { error: "Administrator access required.", status: 403 as const };
  return null;
}

// PATCH /api/drive/files  { id, name }  -> rename a file or folder in Drive
export async function PATCH(request: Request) {
  const blocked = await requireAdmin();
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });
  try {
    const { id, name } = await request.json() as { id?: string; name?: string };
    const clean = name?.trim();
    if (!id || !clean) return NextResponse.json({ error: "A file id and new name are required." }, { status: 400 });
    const file = await renameDriveItem(id, clean);
    return NextResponse.json({ ok: true, file });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unable to rename item.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// POST /api/drive/files  { id, targetId? }  -> move an item into a folder (or root)
export async function POST(request: Request) {
  const blocked = await requireAdmin();
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });
  try {
    const { id, targetId } = await request.json() as { id?: string; targetId?: string };
    if (!id) return NextResponse.json({ error: "A file id is required." }, { status: 400 });
    const result = await moveDriveItem(id, targetId);
    return NextResponse.json({ ok: true, ...result });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unable to move item.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// DELETE /api/drive/files  { id }  -> move a file or folder to Drive trash
export async function DELETE(request: Request) {
  const blocked = await requireAdmin();
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });
  try {
    const { id } = await request.json() as { id?: string };
    if (!id) return NextResponse.json({ error: "A file id is required." }, { status: 400 });
    await deleteDriveItem(id);
    return NextResponse.json({ ok: true });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unable to delete item.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
