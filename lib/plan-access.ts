import { prisma } from "@/lib/prisma";

export const PLAN_ENTITLEMENTS = [
  { key: "dashboard", label: "Dashboard", description: "Personal dashboard and account overview." },
  { key: "profile", label: "Profile", description: "Profile settings and account details." },
  { key: "support", label: "Support", description: "Help center and support tickets." },
  { key: "community", label: "Community", description: "Official links, socials, and brokers." },
  { key: "courses", label: "Courses", description: "Secure video course library." },
  { key: "strategies", label: "Strategies", description: "Member strategy research library." },
  { key: "vipStrategies", label: "VIP strategies", description: "VIP-only strategies and setups." },
  { key: "prioritySupport", label: "Priority support", description: "Higher-priority manual support queue." },
  { key: "reports", label: "Reports", description: "Complete proof reports and trade logs." },
] as const;

export type PlanEntitlement = (typeof PLAN_ENTITLEMENTS)[number]["key"];

const DEFAULT_ENTITLEMENTS: Record<string, PlanEntitlement[]> = {
  free: ["dashboard", "profile", "support", "community"],
  starter: ["dashboard", "profile", "support", "community", "courses"],
  member: ["dashboard", "profile", "support", "community", "courses", "strategies"],
  vip: ["dashboard", "profile", "support", "community", "courses", "strategies", "vipStrategies", "prioritySupport", "reports"],
  admin: PLAN_ENTITLEMENTS.map(item => item.key),
};

export function parseEntitlements(value?: string | null) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String).filter((key): key is PlanEntitlement => PLAN_ENTITLEMENTS.some(item => item.key === key)) : [];
  } catch {
    return [];
  }
}

export function fallbackEntitlements(role?: string | null) {
  return DEFAULT_ENTITLEMENTS[role || "free"] || DEFAULT_ENTITLEMENTS.free;
}

export async function entitlementsForRole(role?: string | null) {
  if (role === "admin") return DEFAULT_ENTITLEMENTS.admin;
  const slug = role === "vip" || role === "member" ? role : role === "starter" ? "starter" : "starter";
  const plan = await prisma.planConfig.findUnique({ where: { slug }, select: { entitlements: true } }).catch(() => null);
  const configured = parseEntitlements(plan?.entitlements);
  return configured.length ? configured : fallbackEntitlements(slug);
}

export async function hasPlanFeature(role: string | undefined | null, feature: PlanEntitlement) {
  return (await entitlementsForRole(role)).includes(feature);
}

export async function canAccessStrategyTier(role: string | undefined | null, accessTier: string) {
  if (role === "admin") return true;
  const entitlements = await entitlementsForRole(role);
  if (accessTier === "vip") return entitlements.includes("vipStrategies");
  if (accessTier === "member") return entitlements.includes("strategies");
  return true;
}
