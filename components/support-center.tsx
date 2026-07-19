"use client";

import Link from "next/link";
import { BookOpenCheck, ChevronRight, CircleHelp, CreditCard, GraduationCap, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { SupportTicketForm } from "@/components/support-ticket-form";

const topics = [
  { icon: GraduationCap, title: "Courses & learning", copy: "Enrollment, lessons, playback and course progress." },
  { icon: BookOpenCheck, title: "Strategies", copy: "Access levels, saved strategies and research reports." },
  { icon: CreditCard, title: "Plans & billing", copy: "Membership, renewals, upgrades and payment questions." },
  { icon: ShieldCheck, title: "Account & security", copy: "Login, profile, privacy and account access." },
];

const faqs = [
  ["How do I continue a course?", "Open Dashboard, choose Continue learning, then select the next lesson. Your progress is saved automatically."],
  ["Where are my saved strategies?", "Your saved strategies appear in the Dashboard and in the Strategy library after you sign in."],
  ["How do I update my profile?", "Open the profile menu in the top-right corner and choose Profile settings."],
  ["Can I attach a screenshot or recording?", "Yes. The support form accepts images, audio, video, PDF, Office files, text, CSV, JSON and ZIP attachments."],
  ["How do I manage my plan?", "Choose Plans in the main navigation or Manage plan from the profile menu."],
];

export function SupportCenter() {
  const [query, setQuery] = useState("");
  const filtered = faqs.filter(([question, answer]) => `${question} ${answer}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <section className="support-hero">
        <div className="support-orb" aria-hidden />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-profit/20 bg-profit/[.06] px-3 py-1.5 text-[10px] font-bold tracking-wider text-profit"><span className="size-1.5 rounded-full bg-profit shadow-[0_0_10px_currentColor]" /> SUPPORT ONLINE</div>
          <h1 className="mt-6 font-display text-5xl font-semibold tracking-[-.05em] md:text-6xl">How can we help?</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">Search quick answers or send the EdgeLedger team a detailed support request in the format that explains it best.</p>
          <label className="mt-8 flex max-w-2xl items-center gap-3 rounded-xl border border-white/10 bg-ink/80 px-4 py-3.5 shadow-2xl focus-within:border-brass/40">
            <Search size={18} className="text-brass" />
            <input aria-label="Search help" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search courses, billing, profile, strategy..." className="w-full bg-transparent text-sm outline-none placeholder:text-muted/50" />
          </label>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {topics.map(({ icon: Icon, title, copy }) => (
          <article key={title} className="dashboard-glow-card p-5">
            <span className="grid size-10 place-items-center rounded-xl border border-brass/15 bg-brass/[.06] text-brass"><Icon size={18} /></span>
            <h2 className="mt-5 text-sm font-semibold">{title}</h2>
            <p className="mt-2 text-xs leading-5 text-muted">{copy}</p>
          </article>
        ))}
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[.82fr_1.18fr]">
        <div className="dashboard-glow-card p-6 md:p-8">
          <div className="flex items-center gap-3"><CircleHelp size={20} className="text-brass" /><h2 className="font-display text-2xl">Quick answers</h2></div>
          <div className="mt-6 divide-y divide-white/[.06]">
            {filtered.length ? filtered.map(([question, answer]) => (
              <details key={question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold"><span>{question}</span><ChevronRight size={15} className="shrink-0 text-muted transition group-open:rotate-90" /></summary>
                <p className="mt-3 pr-6 text-xs leading-6 text-muted">{answer}</p>
              </details>
            )) : <p className="py-8 text-sm text-muted">No quick answer matches that search. Send a request and we will help.</p>}
          </div>
          <Link href="/feedback" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-brass hover:underline"><Sparkles size={14} /> Share a product idea instead</Link>
        </div>
        <SupportTicketForm />
      </section>
    </div>
  );
}
