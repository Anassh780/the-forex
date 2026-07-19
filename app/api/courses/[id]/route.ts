import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (typeof body.thumbnail === "string") data.thumbnail = body.thumbnail;
  if (typeof body.title === "string") data.title = body.title;
  if (typeof body.published === "boolean") data.published = body.published;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const course = await prisma.course.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(course);
}
