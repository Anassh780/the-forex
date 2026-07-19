"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BadgePercent, Check, Crown, Gem, LockKeyhole, ShieldCheck, Sparkles, TicketCheck, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { uniqueBy } from "@/lib/collections";

type Billing = "monthly" | "annual";
type Plan = { id: string; slug: string; name: string; tagline: string; monthlyPrice: number; annualPrice: number; features: string[]; featured: boolean; trialDays: number };
const icons = { starter: Zap, member: Gem, vip: Crown } as const;

function Price({ plan, billing }: { plan: Plan; billing: Billing }) {
  const freePlan = plan.monthlyPrice === 0 && plan.annualPrice === 0;
  const amount = billing === "annual" ? plan.annualPrice : plan.monthlyPrice;
  if (freePlan) return <div className="plan-price-block"><strong className="plan-price-free">Free</strong><small>No payment required</small></div>;
  return <div className="plan-price-block">
    <div className="plan-price">
      {billing === "annual" && plan.annualPrice < plan.monthlyPrice && <del>${plan.monthlyPrice}</del>}
      <span>$</span><strong>{amount}</strong><small>/ month (USD)</small>
    </div>
    <p>{billing === "annual" ? `$${amount * 12} billed yearly` : "Billed monthly"}</p>
  </div>;
}

export function PricingPlans() {
  const [billing, setBilling] = useState<Billing>("annual");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [coupon, setCoupon] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const reduce = useReducedMotion();

  useEffect(() => {
    void fetch("/api/plans", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load plans.");
      setPlans(uniqueBy(Array.isArray(data.plans) ? data.plans : [], plan => plan.id || plan.slug));
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load plans.")).finally(() => setPageLoading(false));
  }, []);

  const annualSaving = useMemo(() => plans.reduce((best, plan) => {
    if (plan.monthlyPrice <= 0 || plan.annualPrice <= 0 || plan.annualPrice >= plan.monthlyPrice) return best;
    return Math.max(best, Math.round((1 - plan.annualPrice / plan.monthlyPrice) * 100));
  }, 0), [plans]);

  async function subscribe(plan: Plan) {
    setError("");
    if (plan.monthlyPrice === 0 && plan.annualPrice === 0) { window.location.href = "/signup"; return; }
    const selectedPrice = billing === "annual" ? plan.annualPrice : plan.monthlyPrice;
    if (selectedPrice <= 0) { setError(`${plan.name} does not have a ${billing} price yet. Choose another billing option.`); return; }
    setLoading(plan.id);
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: plan.id, billing, couponCode: coupon.trim() }) });
      const data = await response.json();
      if (response.status === 401) { window.location.href = "/login?callbackUrl=/vip"; return; }
      if (!response.ok) throw new Error(data.error || "Unable to start checkout.");
      if (data.url) window.location.href = data.url;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to start checkout."); } finally { setLoading(null); }
  }

  return <section className="plans-stage">
    <div className="plans-aurora one" aria-hidden /><div className="plans-aurora two" aria-hidden />
    <div className="container-shell relative z-10">
      <section className="plans-board">
        <header className="plans-board-head">
          <div><span className="eyebrow">MEMBERSHIP</span><h1>Pricing</h1><p>Choose access that matches the way you learn and research.</p></div>
          <div className="plans-billing-choice" role="group" aria-label="Billing period">
            <button type="button" className={billing === "annual" ? "active" : ""} onClick={() => setBilling("annual")}>Annual{annualSaving > 0 && <span>Save {annualSaving}%</span>}</button>
            <button type="button" className={billing === "monthly" ? "active" : ""} onClick={() => setBilling("monthly")}>Monthly</button>
          </div>
          <label className="plans-coupon"><BadgePercent size={16} /><input value={coupon} onChange={event => setCoupon(event.target.value.toUpperCase())} placeholder="Coupon code" maxLength={32} /></label>
        </header>

        {pageLoading ? <div className="plans-loading"><span className="admin-spinner" /> Loading current prices…</div> : <div className="plans-cards">
          {plans.map((plan, index) => { const Icon = icons[plan.slug as keyof typeof icons] || Gem; const selectedPrice = billing === "annual" ? plan.annualPrice : plan.monthlyPrice; const missingPrice = !(plan.monthlyPrice === 0 && plan.annualPrice === 0) && selectedPrice <= 0; return <motion.article key={plan.id} initial={reduce ? false : { opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .07, .14) }} className={`plan-card ${plan.featured ? "featured" : ""}`}>
            <div className="plan-card-status">{plan.featured ? <><Sparkles size={12} /> Most popular</> : <>Plan {String(index + 1).padStart(2, "0")}</>}</div>
            <div className="plan-top"><span><Icon size={21} /></span><h2>{plan.name}</h2></div>
            <Price plan={plan} billing={billing} />
            {missingPrice && <p className="plan-missing-price">{billing} price is not configured</p>}
            <p className="plan-tagline">{plan.tagline}</p>
            {plan.trialDays > 0 && <div className="plan-trial"><Sparkles size={12} /> {plan.trialDays}-day free trial</div>}
            <div className="plan-includes"><small>WHAT&apos;S INCLUDED</small><ul>{plan.features.map(feature => <li key={feature}><span><Check size={12} /></span>{feature}</li>)}</ul></div>
            <button type="button" onClick={() => subscribe(plan)} disabled={loading === plan.id || missingPrice}>{loading === plan.id ? <span className="admin-spinner" /> : <>{plan.monthlyPrice === 0 && plan.annualPrice === 0 ? "Create free account" : plan.trialDays > 0 ? `Start ${plan.trialDays}-day trial` : `Choose ${plan.name}`}<ArrowRight size={16} /></>}</button>
          </motion.article>; })}
        </div>}
        {error && <p className="plans-error">{error}</p>}
        <div className="plans-trust"><span><LockKeyhole size={15} /> Protected checkout</span><span><TicketCheck size={15} /> Trackable support</span><span><ShieldCheck size={15} /> Cancel through billing</span></div>
      </section>
    </div>
  </section>;
}
