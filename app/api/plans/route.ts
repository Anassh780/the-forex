import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
function features(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } }

export async function GET() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "admin";
  const [plans, coupons] = await Promise.all([
    prisma.planConfig.findMany({ where: isAdmin ? {} : { active: true }, orderBy: { sortOrder: "asc" } }),
    isAdmin ? prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);
  return NextResponse.json({ plans: plans.map(plan => ({ ...plan, features: features(plan.features) })), coupons });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json();
  const monthlyPrice = Math.max(0, Number(body.monthlyPrice) || 0);
  const annualPrice = Math.max(0, Number(body.annualPrice) || 0);
  const trialDays = Math.max(0, Math.min(365, Math.trunc(Number(body.trialDays) || 0)));
  const updated = await prisma.planConfig.update({ where: { id: String(body.id) }, data: {
    name: String(body.name || "").trim().slice(0, 80), tagline: String(body.tagline || "").trim().slice(0, 240), monthlyPrice, annualPrice, trialDays,
    featured: Boolean(body.featured), active: body.active !== false, features: JSON.stringify(Array.isArray(body.features) ? body.features.map(String).filter(Boolean).slice(0, 20) : []),
    monthlyStripePriceId: String(body.monthlyStripePriceId || "").trim() || null, annualStripePriceId: String(body.annualStripePriceId || "").trim() || null,
  } });
  return NextResponse.json({ ...updated, features: features(updated.features) });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  try {
    const body = await request.json();
    const code = String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (code.length < 3) throw new Error("Coupon code must contain at least 3 characters.");
    const discountPercent = Math.max(1, Math.min(100, Math.trunc(Number(body.discountPercent) || 0)));
    const coupon = await prisma.coupon.create({ data: { code, discountPercent, description: String(body.description || "").slice(0, 240) || null, appliesTo: JSON.stringify(Array.isArray(body.appliesTo) ? body.appliesTo : []), active: body.active !== false, startsAt: body.startsAt ? new Date(body.startsAt) : null, endsAt: body.endsAt ? new Date(body.endsAt) : null, maxRedemptions: body.maxRedemptions ? Math.max(1, Math.trunc(Number(body.maxRedemptions))) : null } });
    return NextResponse.json(coupon, { status: 201 });
  } catch (reason) { return NextResponse.json({ error: reason instanceof Error ? reason.message : "Unable to create coupon." }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing coupon id." }, { status: 400 });
  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
