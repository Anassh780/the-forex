import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const courses = await prisma.course.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      level: true,
      market: true,
      price: true,
      thumbnail: true,
      published: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(courses);
}
