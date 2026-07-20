import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { amountForPlan, grantPlanAccess, type Billing } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { saveUserFile, type StoredUserFile } from "@/lib/user-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseBilling(value: FormDataEntryValue | null): Billing {
  return value === "monthly" ? "monthly" : "annual";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const isAdmin = session.user.role === "admin";
  const payments = await prisma.manualPayment.findMany({
    where: isAdmin ? {} : { userId: session.user.id },
    include: {
      method: true,
      user: { select: { id: true, email: true, name: true, image: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: isAdmin ? 200 : 30,
  });
  return NextResponse.json({ payments });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let stored: StoredUserFile | null = null;
  try {
    const form = await request.formData();
    const planId = String(form.get("planId") || "");
    const methodId = String(form.get("methodId") || "");
    const billing = parseBilling(form.get("billing"));
    const transactionId = String(form.get("transactionId") || "").trim();
    const note = String(form.get("note") || "").trim().slice(0, 800);
    const proof = form.get("screenshot");

    if (!transactionId || transactionId.length < 4) throw new Error("Enter a valid transaction ID or wallet hash.");
    if (!(proof instanceof File) || proof.size <= 0) throw new Error("Attach your payment screenshot or PDF receipt.");

    const [plan, method] = await Promise.all([
      prisma.planConfig.findFirst({ where: { OR: [{ id: planId }, { slug: planId }], active: true } }),
      prisma.paymentMethod.findFirst({ where: { id: methodId, active: true } }),
    ]);
    if (!plan) throw new Error("Selected plan is not available.");
    if (!method) throw new Error("Selected payment method is unavailable.");

    const amount = amountForPlan(plan, billing);
    if (amount <= 0) throw new Error("This plan does not require manual payment.");

    stored = await saveUserFile(proof, "payments", session.user.id);
    const payment = await prisma.manualPayment.create({
      data: {
        userId: session.user.id,
        planId: plan.id,
        planSlug: plan.slug,
        planName: plan.name,
        billing,
        amount,
        methodId: method.id,
        transactionId: transactionId.slice(0, 160),
        screenshot: stored.url,
        note: note || null,
      },
      include: { method: true },
    });
    return NextResponse.json({ ok: true, payment }, { status: 201 });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unable to submit payment proof.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  try {
    const body = await request.json();
    const id = String(body.id || "");
    const status = body.status === "approved" ? "approved" : body.status === "rejected" ? "rejected" : "";
    if (!id || !status) throw new Error("Choose approve or reject.");

    const existing = await prisma.manualPayment.findUnique({ where: { id } });
    if (!existing) throw new Error("Payment request not found.");
    if (existing.status === "approved") throw new Error("This payment is already approved.");

    const payment = await prisma.manualPayment.update({
      where: { id },
      data: {
        status,
        reviewedBy: session.user.email || session.user.id,
        reviewedAt: new Date(),
        adminNote: String(body.adminNote || "").trim().slice(0, 500) || null,
      },
      include: { user: { select: { id: true, email: true, name: true, role: true } }, method: true },
    });

    if (status === "approved") {
      await grantPlanAccess({
        userId: payment.userId,
        planSlug: payment.planSlug,
        billing: payment.billing as Billing,
        sourceId: `manual_${payment.id}`,
      });
    }

    return NextResponse.json({ ok: true, payment });
  } catch (reason) {
    return NextResponse.json({ error: reason instanceof Error ? reason.message : "Unable to review payment." }, { status: 400 });
  }
}
