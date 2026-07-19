import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const uploadUrl = request.headers.get("x-upload-url");
  if (!uploadUrl) return NextResponse.json({ error: "Missing upload URL." }, { status: 400 });

  const contentRange = request.headers.get("content-range");
  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const contentLength = request.headers.get("content-length");

  const headers: Record<string, string> = { "Content-Type": contentType };
  if (contentRange) headers["Content-Range"] = contentRange;
  if (contentLength) headers["Content-Length"] = contentLength;

  try {
    const body = await request.arrayBuffer();
    const upstream = await fetch(uploadUrl, {
      method: "PUT",
      headers,
      body,
    });

    if (![200, 201, 308].includes(upstream.status)) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: `Upload rejected by storage provider (${upstream.status}).`, detail: text },
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }

    if (upstream.status === 200 || upstream.status === 201) {
      const fileData = await upstream.json().catch(() => null) as { id?: string; name?: string } | null;
      return NextResponse.json({ ok: true, status: upstream.status, file: fileData });
    }

    return NextResponse.json({ ok: true, status: upstream.status });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Chunk upload failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
