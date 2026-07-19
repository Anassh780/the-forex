"use client";
/* eslint-disable @next/next/no-img-element -- admin-configurable remote official brand assets */

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Building2, Globe2, Radio, ShieldAlert, Users2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { uniqueBy } from "@/lib/collections";

type CommunityLink = { id: string; key: string; name: string; category: "social" | "broker"; description: string; url: string; logoUrl: string; accent: string };

export function CommunityHub() {
  const [links, setLinks] = useState<CommunityLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reduce = useReducedMotion();

  useEffect(() => {
    void fetch("/api/community", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load community links.");
      setLinks(uniqueBy(Array.isArray(data) ? data : [], link => link.id || link.key));
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load community links.")).finally(() => setLoading(false));
  }, []);

  const uniqueLinks = useMemo(() => uniqueBy(links, link => link.id || link.key), [links]);
  const groups = useMemo(() => [
    { key: "social", title: "Social desk", copy: "Official EdgeLedger channels.", icon: Users2, items: uniqueLinks.filter(link => link.category === "social") },
    { key: "broker", title: "Broker directory", copy: "Admin-curated external destinations. Confirm regional terms before opening an account.", icon: Building2, items: uniqueLinks.filter(link => link.category === "broker") },
  ], [uniqueLinks]);

  return <div className="community-page">
    <section className="community-hero">
      <div aria-hidden className="community-pulse" />
      <div className="relative z-10 max-w-3xl">
        <span className="community-live"><Radio size={13} /> COMMUNITY DIRECTORY <i /> LIVE</span>
        <h1>Trade around people,<br /><span>not in isolation.</span></h1>
        <p>One clean directory for EdgeLedger channels and external trading platforms—kept current by the admin team.</p>
        <div className="community-stats"><span><strong>{uniqueLinks.filter(x => x.category === "social").length}</strong> social channels</span><span><strong>{uniqueLinks.filter(x => x.category === "broker").length}</strong> broker links</span><span><Globe2 size={15} /> admin verified</span></div>
      </div>
    </section>

    {loading ? <div className="community-loading">Loading directory…</div> : error ? <p className="error-text">{error}</p> : groups.map((group, groupIndex) => <section key={group.key} className="community-group">
      <div className="community-group-head"><span><group.icon size={19} /></span><div><h2>{group.title}</h2><p>{group.copy}</p></div></div>
      <div className="community-grid">
        {group.items.map((item, index) => <motion.a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className={`community-card ${item.category} community-${item.key}`} style={{ "--community-accent": item.accent } as React.CSSProperties}
          initial={reduce ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={{ delay: Math.min(groupIndex * .05 + index * .035, .16) }} whileHover={reduce ? undefined : { y: -7 }}>
          <span className="community-logo"><b aria-hidden>{item.name.slice(0, 2).toUpperCase()}</b><img src={item.logoUrl} alt={`${item.name} logo`} onError={event => { event.currentTarget.style.display = "none"; }} /></span>
          <span className="community-kind">{item.category === "broker" ? "EXTERNAL BROKER" : "SOCIAL CHANNEL"}</span>
          <h3>{item.name}</h3>{item.category === "broker" && <p>{item.description}</p>}
          <span className="community-open">Open official link <ArrowUpRight size={15} /></span>
        </motion.a>)}
      </div>
    </section>)}

    <div className="community-risk"><ShieldAlert size={19} /><p><strong>External-link and risk notice.</strong> Broker cards are directory links, not a guarantee, recommendation, or endorsement. Leveraged trading can result in loss. Check regulation, availability, pricing, and risk disclosures for your region.</p></div>
  </div>;
}
