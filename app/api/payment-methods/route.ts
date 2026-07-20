import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "admin";
  const methods = await prisma.paymentMethod.findMany({
    where: isAdmin ? {} : { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ methods });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  try {
    const body = await request.json();
    const id = String(body.id || "");
    if (!id) throw new Error("Missing payment method id.");
    const updated = await prisma.paymentMethod.update({
      where: { id },
      data: {
        name: String(body.name || "").trim().slice(0, 80),
        type: ["wallet", "bank", "crypto"].includes(body.type) ? body.type : "wallet",
        logoUrl: String(body.logoUrl || "").trim().slice(0, 500),
        accent: String(body.accent || "#9bf56a").trim().slice(0, 24),
        accountName: String(body.accountName || "").trim().slice(0, 120) || null,
        accountNo: String(body.accountNo || "").trim().slice(0, 120) || null,
        address: String(body.address || "").trim().slice(0, 240) || null,
        network: String(body.network || "").trim().slice(0, 80) || null,
        instructions: String(body.instructions || "").trim().slice(0, 800),
        active: body.active !== false,
        sortOrder: Math.trunc(Number(body.sortOrder) || 0),
      },
    });
    return NextResponse.json(updated);
  } catch (reason) {
    return NextResponse.json({ error: reason instanceof Error ? reason.message : "Unable to update payment method." }, { status: 400 });
  }
}
