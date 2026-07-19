import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeUserFile, saveUserFile, type StoredUserFile } from "@/lib/user-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = new Set(["product", "course", "strategy", "support", "bug", "other"]);

function parseAttachments(value: string): StoredUserFile[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const feedback = await prisma.feedback.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(feedback.map(item => ({ ...item, attachments: parseAttachments(item.attachments) })));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const stored: StoredUserFile[] = [];
  try {
    const form = await request.formData();
    const message = String(form.get("message") || "").trim();
    const categoryValue = String(form.get("category") || "other").toLowerCase();
    const category = CATEGORIES.has(categoryValue) ? categoryValue : "other";
    const rating = Number(form.get("rating") || 0);
    const files = form.getAll("attachments").filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!message && files.length === 0) return NextResponse.json({ error: "Write feedback or attach a file." }, { status: 400 });
    if (message.length > 4000) return NextResponse.json({ error: "Feedback must be 4,000 characters or fewer." }, { status: 400 });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Choose a rating from 1 to 5." }, { status: 400 });
    if (files.length > 5) return NextResponse.json({ error: "You can attach up to 5 files." }, { status: 400 });
    if (files.reduce((total, file) => total + file.size, 0) > 4 * 1024 * 1024) return NextResponse.json({ error: "Combined attachments must be 4 MB or less." }, { status: 400 });

    for (const file of files) stored.push(await saveUserFile(file, "feedback", session.user.id));
    const created = await prisma.feedback.create({
      data: { userId: session.user.id, category, rating, message, attachments: JSON.stringify(stored) },
    });
    return NextResponse.json({ ok: true, feedback: { ...created, attachments: stored } }, { status: 201 });
  } catch (reason) {
    await Promise.all(stored.map(file => removeUserFile(file.url)));
    const message = reason instanceof Error ? reason.message : "Unable to send feedback.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
