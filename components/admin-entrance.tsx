"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function AdminEntrance() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (status !== "authenticated") return null;
  if (role !== "admin") return null;

  return (
    <section className="hero-access-card">
      <div>
        <div className="eyebrow text-brass">Admin section</div>
        <h2>Open admin management anytime</h2>
        <p>Tap to load the admin workspace and control storage, content, users, and strategies from inside the app.</p>
      </div>
      <Link href="/admin-ui" className="cta-primary">Open admin UI <ArrowRight size={18} /></Link>
    </section>
  );
}
