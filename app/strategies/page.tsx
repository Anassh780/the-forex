"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowUpRight, Pencil, Trash2 } from "lucide-react";
import { Reveal } from "@/components/ui";
import { CandleLoader } from "@/components/candle-loader";
import { strategies as staticStrategies } from "@/lib/data";
import { uniqueBy } from "@/lib/collections";

type Strategy = {
  id: string;
  slug: string;
  title: string;
  concept: string;
  instrument: string;
  timeframe: string;
  accessTier: string;
  heroImage: string | null;
  backtest: {
    winRate: string;
    avgRR: string;
  } | null;
};

const TIER_LABEL: Record<string, string> = { free: "FREE", member: "MEMBER", vip: "VIP", admin: "ADMIN" };
const FILTERS = ["All models", "Forex", "Indices", "Commodities", "VIP only"];

function matchesFilter(strategy: Strategy, filter: string) {
  if (filter === "All models") return true;
  if (filter === "VIP only") return strategy.accessTier === "vip";
  const inst = strategy.instrument.toLowerCase();
  if (filter === "Forex") return inst.includes("/") && !inst.includes("xau") && !inst.includes("nas") && !inst.includes("spx") && !inst.includes("us30");
  if (filter === "Indices") return inst.includes("nas") || inst.includes("spx") || inst.includes("us30") || inst.includes("dax") || inst.includes("ftse");
  if (filter === "Commodities") return inst.includes("xau") || inst.includes("oil") || inst.includes("xag");
  return true;
}

export default function Strategies() {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All models");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/strategies", { cache: "no-store" })
      .then(async res => {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setStrategies(uniqueBy(data, strategy => strategy.id || strategy.slug));
        } else {
          setStrategies(uniqueBy(staticStrategies.map(s => ({
            id: s.slug,
            slug: s.slug,
            title: s.title,
            concept: s.concept,
            instrument: s.instrument,
            timeframe: s.timeframe,
            accessTier: s.access.toLowerCase(),
            heroImage: null,
            backtest: { winRate: String(s.winRate), avgRR: String(s.rr) },
          })), strategy => strategy.id || strategy.slug));
        }
      })
      .catch(() => {
        setStrategies(uniqueBy(staticStrategies.map(s => ({
          id: s.slug,
          slug: s.slug,
          title: s.title,
          concept: s.concept,
          instrument: s.instrument,
          timeframe: s.timeframe,
          accessTier: s.access.toLowerCase(),
          heroImage: null,
          backtest: { winRate: String(s.winRate), avgRR: String(s.rr) },
        })), strategy => strategy.id || strategy.slug));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = strategies.filter(s => matchesFilter(s, activeFilter));

  async function handleDelete(id: string) {
    if (!confirm("Delete this strategy permanently?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/strategies/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Delete failed." }));
        alert(data.error || "Delete failed.");
        return;
      }
      setStrategies(prev => uniqueBy(prev.filter(s => s.id !== id), strategy => strategy.id || strategy.slug));
    } finally {
      setDeleting(null);
    }
  }

  return <div className="container-shell py-20">
    <Reveal>
      <div className="eyebrow">Research library / {String(strategies.length).padStart(2, "0")} active models</div>
      <h1 className="mt-5 max-w-3xl font-display text-6xl font-semibold tracking-[-.055em]">Strategies with nothing hidden.</h1>
      <p className="mt-5 max-w-xl text-sm leading-7 text-muted">Filter the thesis. Inspect the full sample. Decide whether the edge belongs in your playbook.</p>
    </Reveal>

    <div className="mt-14 flex flex-wrap gap-2 border-b hairline pb-5">
      {FILTERS.map(x => (
        <button key={x} onClick={() => setActiveFilter(x)} className={`border px-4 py-2 text-[10px] font-bold tracking-wider ${activeFilter === x ? "border-brass/50 text-brass" : "border-white/10 text-muted hover:border-white/20"}`}>{x}</button>
      ))}
    </div>

    {loading ? (
      <div className="mt-20 flex justify-center"><CandleLoader label="Loading strategies" /></div>
    ) : (
      <div className="mt-2">
        {filtered.map((s, i) => (
          <Reveal key={s.id} delay={i * .06}>
            <div className="group relative grid gap-5 border-b hairline py-8 transition hover:bg-white/[.018] md:grid-cols-[1.4fr_.8fr_.6fr_auto] md:items-center md:px-5">
              <Link href={`/strategies/${s.slug}`} className="absolute inset-0 z-0" />
              <div className="relative z-10">
                <span className={`font-mono text-[9px] tracking-wider ${s.accessTier === "vip" ? "text-brass" : "text-profit"}`}>{TIER_LABEL[s.accessTier] || s.accessTier.toUpperCase()}</span>
                <h2 className="mt-2 font-display text-2xl font-semibold">{s.title}</h2>
                <p className="mt-1 text-xs text-muted">{s.concept}</p>
              </div>
              <div className="relative z-10 flex gap-3 text-[10px] font-semibold tracking-wider text-muted">
                <span className="border hairline px-2 py-1">{s.instrument}</span>
                <span className="border hairline px-2 py-1">{s.timeframe}</span>
              </div>
              <div className="relative z-10 grid grid-cols-2 gap-5 font-mono">
                <div>
                  <div className="text-lg text-profit">{s.backtest ? `${Number(s.backtest.winRate).toFixed(1)}%` : "--"}</div>
                  <div className="text-[9px] text-muted">WIN RATE</div>
                </div>
                <div>
                  <div className="text-lg">{s.backtest ? `${Number(s.backtest.avgRR).toFixed(2)}R` : "--"}</div>
                  <div className="text-[9px] text-muted">AVG R:R</div>
                </div>
              </div>
              {isAdmin ? (
                <div className="relative z-10 flex items-center gap-2">
                  <button
                    onClick={(e) => { e.preventDefault(); router.push(`/strategies/${s.slug}?edit=true`); }}
                    className="rounded border border-white/10 p-2 text-muted transition hover:border-brass/50 hover:text-brass"
                    title="Edit strategy"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); handleDelete(s.id); }}
                    disabled={deleting === s.id}
                    className="rounded border border-white/10 p-2 text-muted transition hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
                    title="Delete strategy"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : (
                <ArrowUpRight className="relative z-10 text-muted transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-brass" />
              )}
            </div>
          </Reveal>
        ))}
        {filtered.length === 0 && (
          <div className="py-20 text-center text-muted">No strategies match this filter.</div>
        )}
      </div>
    )}
  </div>;
}
