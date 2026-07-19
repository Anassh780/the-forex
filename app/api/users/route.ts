import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      status: true,
      suspendedAt: true,
      suspensionReason: true,
      createdAt: true,
      _count: { select: { purchases: true, progress: true, savedStrategies: true, supportTickets: true, securityEvents: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    isOwner: isPlatformOwnerEmail(session.user.email),
    users: users.map((user) => ({ ...user, isOwner: isPlatformOwnerEmail(user.email) })),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  if (!isPlatformOwnerEmail(session.user.email)) {
    return NextResponse.json({ error: "Only the main owner can grant full administrator access." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid account email.");

    const account = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, role: true } });
    if (!account) throw new Error("That email must create an EdgeLedger account before access can be granted.");

    const updated = await prisma.user.update({
      where: { id: account.id },
      data: { role: "admin", status: "active", suspendedAt: null, suspensionReason: null },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
    await prisma.securityEvent.create({
      data: {
        userId: account.id,
        type: "administrator_access_granted",
        severity: "high",
        status: "resolved",
        resolvedAt: new Date(),
        details: JSON.stringify({ grantedBy: session.user.email, grantedTo: email }),
      },
    });
    return NextResponse.json(updated);
  } catch (reason) {
    return NextResponse.json({ error: reason instanceof Error ? reason.message : "Unable to grant administrator access." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  try {
    const body = await request.json();
    const id = String(body.id || "");
    if (!id) throw new Error("Missing user id.");
    const target = await prisma.user.findUnique({ where: { id }, select: { email: true, role: true } });
    if (!target) throw new Error("User account not found.");
    const requesterIsOwner = isPlatformOwnerEmail(session.user.email);
    const targetIsOwner = isPlatformOwnerEmail(target.email);
    if (id === session.user.id && body.status === "suspended") throw new Error("You cannot suspend your own administrator account.");
    if (targetIsOwner && (body.status === "suspended" || (body.role && body.role !== "admin"))) throw new Error("The main owner account cannot be suspended or demoted.");
    if (!requesterIsOwner && (body.role === "admin" || (target.role === "admin" && (body.role || body.status)))) {
      throw new Error("Only the main owner can grant or revoke administrator access.");
    }
    const role = ["free", "member", "vip", "admin"].includes(body.role) ? body.role : undefined;
    const status = ["active", "review", "suspended"].includes(body.status) ? body.status : undefined;
    const updated = await prisma.user.update({ where: { id }, data: {
      role,
      status,
      suspensionReason: status === "suspended" ? String(body.reason || "Administrative review").slice(0, 500) : status ? null : undefined,
      suspendedAt: status === "suspended" ? new Date() : status ? null : undefined,
    }, select: { id: true, name: true, email: true, image: true, role: true, status: true, suspendedAt: true, suspensionReason: true, createdAt: true } });
    return NextResponse.json(updated);
  } catch (reason) {
    return NextResponse.json({ error: reason instanceof Error ? reason.message : "Unable to update user." }, { status: 400 });
  }
}
