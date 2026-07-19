import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeUserFile, saveUserFile, type StoredUserFile } from "@/lib/user-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function attachments(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const isAdmin = session.user.role === "admin";
  const tickets = await prisma.supportTicket.findMany({
    where: isAdmin ? {} : { userId: session.user.id }, include: { user: { select: { id: true, name: true, email: true, image: true, status: true } } },
    orderBy: { createdAt: "desc" }, take: isAdmin ? 150 : 30,
  });
  return NextResponse.json(tickets.map(ticket => ({ ...ticket, attachments: attachments(ticket.attachments) })));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const stored: StoredUserFile[] = [];
  try {
    const form = await request.formData();
    const subject = String(form.get("subject") || "").trim();
    const message = String(form.get("message") || "").trim();
    const category = String(form.get("category") || "account").trim().slice(0, 40);
    const priority = ["normal", "high", "urgent"].includes(String(form.get("priority"))) ? String(form.get("priority")) : "normal";
    const files = form.getAll("attachments").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (subject.length < 4 || subject.length > 140) throw new Error("Subject must be between 4 and 140 characters.");
    if (message.length < 10 || message.length > 6000) throw new Error("Message must be between 10 and 6,000 characters.");
    if (files.length > 5 || files.reduce((sum, file) => sum + file.size, 0) > 4 * 1024 * 1024) throw new Error("Attach up to 5 files with a combined size of 4 MB.");
    for (const file of files) stored.push(await saveUserFile(file, "support", session.user.id));
    const created = await prisma.supportTicket.create({ data: { userId: session.user.id, subject, message, category, priority, attachments: JSON.stringify(stored) } });
    return NextResponse.json({ ...created, attachments: stored }, { status: 201 });
  } catch (reason) {
    await Promise.all(stored.map(file => removeUserFile(file.url)));
    return NextResponse.json({ error: reason instanceof Error ? reason.message : "Unable to open ticket." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json();
  const status = ["open", "in_progress", "resolved", "closed"].includes(body.status) ? body.status : "open";
  const updated = await prisma.supportTicket.update({ where: { id: String(body.id) }, data: { status, priority: ["normal", "high", "urgent"].includes(body.priority) ? body.priority : undefined, closedAt: ["resolved", "closed"].includes(status) ? new Date() : null } });
  return NextResponse.json(updated);
}
