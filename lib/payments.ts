import { prisma } from "@/lib/prisma";

export type Billing = "monthly" | "annual";

export function roleForPlan(slug: string) {
  if (slug === "vip") return "vip";
  if (slug === "member") return "member";
  return "free";
}

export function amountForPlan(plan: { monthlyPrice: number; annualPrice: number }, billing: Billing) {
  return billing === "annual" ? Math.max(0, plan.annualPrice * 12) : Math.max(0, plan.monthlyPrice);
}

export async function grantPlanAccess(input: {
  userId: string;
  planSlug: string;
  billing: Billing | "trial";
  sourceId: string;
  days?: number;
}) {
  const role = roleForPlan(input.planSlug);
  const now = Date.now();
  const durationDays = input.days || (input.billing === "annual" ? 365 : 30);
  const currentPeriodEnd = new Date(now + durationDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: input.userId },
      data: { role: role === "free" ? undefined : role, status: "active", suspendedAt: null, suspensionReason: null },
    }),
    prisma.subscription.upsert({
      where: { stripeSubscriptionId: input.sourceId },
      create: {
        userId: input.userId,
        stripeSubscriptionId: input.sourceId,
        tier: input.planSlug,
        status: input.billing === "trial" ? "trialing" : "active",
        currentPeriodEnd,
      },
      update: {
        tier: input.planSlug,
        status: input.billing === "trial" ? "trialing" : "active",
        currentPeriodEnd,
      },
    }),
  ]);

  return { role, currentPeriodEnd };
}
