import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { readUserFile } from "@/lib/user-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { kind: string; fileName: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const file = await readUserFile(params.kind, params.fileName);
  if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });
  return new NextResponse(Uint8Array.from(file.bytes).buffer, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
