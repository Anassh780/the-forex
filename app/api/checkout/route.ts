import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { amountForPlan, grantPlanAccess } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

function appliesTo(value: string, slug: string) {
  try { const parsed = JSON.parse(value); return !Array.isArray(parsed) || parsed.length === 0 || parsed.includes(slug); } catch { return true; }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { planId, billing = "annual", couponCode = "" } = await request.json();
    if (!planId || !["monthly", "annual"].includes(billing)) throw new Error("Choose a valid plan and billing period.");
    const plan = await prisma.planConfig.findFirst({ where: { OR: [{ id: String(planId) }, { slug: String(planId) }], active: true } });
    if (!plan) throw new Error("This plan is not available for checkout.");

    if (plan.trialDays > 0) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() }, select: { id: true } });
      if (!user) throw new Error("User account not found.");
      const access = await grantPlanAccess({
        userId: user.id,
        planSlug: plan.slug,
        billing: "trial",
        sourceId: `trial_${user.id}_${plan.slug}`,
        days: plan.trialDays,
      });
      return NextResponse.json({ ok: true, trial: true, role: access.role, redirect: "/dashboard?trial=started" });
    }

    if (plan.monthlyPrice <= 0) throw new Error("This plan is not available for checkout.");

    let coupon: Awaited<ReturnType<typeof prisma.coupon.findUnique>> = null;
    const now = new Date();
    if (couponCode) {
      coupon = await prisma.coupon.findUnique({ where: { code: String(couponCode).trim().toUpperCase() } });
      const valid = coupon && coupon.active && (!coupon.startsAt || coupon.startsAt <= now) && (!coupon.endsAt || coupon.endsAt >= now) && (!coupon.maxRedemptions || coupon.redemptionCount < coupon.maxRedemptions) && appliesTo(coupon.appliesTo, plan.slug);
      if (!valid) throw new Error("That coupon is invalid, expired, or not available for this plan.");
    }

    const baseAmount = amountForPlan(plan, billing);
    const amount = Math.max(50, Math.round(baseAmount * 100 * (1 - (coupon?.discountPercent || 0) / 100)));
    const configuredPrice = billing === "annual" ? plan.annualStripePriceId : plan.monthlyStripePriceId;
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Manual wallet and crypto payment is available from the pricing page." }, { status: 409 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = configuredPrice && !coupon
      ? { price: configuredPrice, quantity: 1 }
      : { quantity: 1, price_data: { currency: "usd", unit_amount: amount, recurring: { interval: billing === "annual" ? "year" : "month" }, product_data: { name: `EdgeLedger ${plan.name}`, description: plan.tagline } } };

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: session.user.email,
      line_items: [lineItem],
      subscription_data: {
        ...(plan.trialDays > 0 ? { trial_period_days: plan.trialDays } : {}),
        metadata: { plan: plan.slug, billing, coupon: coupon?.code || "" },
      },
      success_url: `${base}/dashboard?checkout=success`,
      cancel_url: `${base}/vip`,
      metadata: { plan: plan.slug, coupon: coupon?.code || "" },
    });
    if (coupon) await prisma.coupon.update({ where: { id: coupon.id }, data: { redemptionCount: { increment: 1 } } });
    return NextResponse.json({ url: checkout.url });
  } catch (reason) {
    return NextResponse.json({ error: reason instanceof Error ? reason.message : "Unable to start checkout." }, { status: 400 });
  }
}
