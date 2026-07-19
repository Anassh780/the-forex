import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function admin() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "admin";
}

function safeUrl(value: unknown) {
  const url = String(value || "").trim();
  if (!/^https:\/\//i.test(url)) throw new Error("Links and logos must use HTTPS.");
  return url;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "admin";
  const links = await prisma.communityLink.findMany({ where: isAdmin ? {} : { active: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  return NextResponse.json(links);
}

export async function POST(request: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  try {
    const body = await request.json();
    const created = await prisma.communityLink.create({ data: {
      key: String(body.key || body.name || "link").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name: String(body.name || "").trim().slice(0, 80), category: body.category === "broker" ? "broker" : "social",
      description: String(body.description || "").trim().slice(0, 500), url: safeUrl(body.url), logoUrl: safeUrl(body.logoUrl),
      accent: /^#[0-9a-f]{6}$/i.test(body.accent) ? body.accent : "#9bf56a", sortOrder: Number(body.sortOrder) || 0, active: body.active !== false,
    } });
    return NextResponse.json(created, { status: 201 });
  } catch (reason) { return NextResponse.json({ error: reason instanceof Error ? reason.message : "Unable to create link." }, { status: 400 }); }
}

export async function PUT(request: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  try {
    const body = await request.json();
    const updated = await prisma.communityLink.update({ where: { id: String(body.id) }, data: {
      name: String(body.name || "").trim().slice(0, 80), category: body.category === "broker" ? "broker" : "social",
      description: String(body.description || "").trim().slice(0, 500), url: safeUrl(body.url), logoUrl: safeUrl(body.logoUrl),
      accent: /^#[0-9a-f]{6}$/i.test(body.accent) ? body.accent : "#9bf56a", sortOrder: Number(body.sortOrder) || 0, active: body.active !== false,
    } });
    return NextResponse.json(updated);
  } catch (reason) { return NextResponse.json({ error: reason instanceof Error ? reason.message : "Unable to update link." }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing link id." }, { status: 400 });
  await prisma.communityLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
