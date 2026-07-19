import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const events = await prisma.securityEvent.findMany({ include: { user: { select: { id: true, name: true, email: true, image: true, status: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json(events);
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json();
  const status = body.status === "resolved" ? "resolved" : "open";
  const event = await prisma.securityEvent.update({ where: { id: String(body.id) }, data: { status, resolvedAt: status === "resolved" ? new Date() : null } });
  return NextResponse.json(event);
}
