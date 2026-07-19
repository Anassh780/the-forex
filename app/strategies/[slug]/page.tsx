"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check, Download, Expand, LockKeyhole, Pencil, SlidersHorizontal, Trash2, X } from "lucide-react";
import { EquityChart } from "@/components/equity-chart";
import { Button, Modal, Reveal, StatCounter } from "@/components/ui";
import { CandleLoader } from "@/components/candle-loader";
import { strategies as staticStrategies, trades as staticTrades } from "@/lib/data";

type ProofImage = {
  fileId: string;
  label: string;
  rMultiple: string;
  direction: string;
  description: string;
};

type Trade = {
  id: string;
  date: string;
  pair: string;
  direction: "long" | "short";
  result: "win" | "loss" | "breakeven";
  rMultiple: string;
};

type BacktestResult = {
  winRate: string | number;
  avgRR: string | number;
  maxDrawdown: string | number;
  totalTrades: number;
  equityCurveData: Array<{ trade?: number; value?: number; equity?: number }> | null;
  trades: Trade[];
};

type StrategyData = {
  id: string;
  slug: string;
  title: string;
  concept: string;
  instrument: string;
  timeframe: string;
  description: string;
  accessTier: string;
  heroImage: string | null;
  proofImages: ProofImage[] | null;
  published: boolean;
  createdAt: string;
  backtest: BacktestResult | null;
};

function formatTradeDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("en", { month: "short" }).toUpperCase()} ${d.getFullYear()}`;
}

function formatR(r: string | number) {
  const n = Number(r);
  return n >= 0 ? `+${n.toFixed(2)}R` : `${n.toFixed(2)}R`;
}

export default function StrategyProof() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const slug = params?.slug as string;
  const [strategy, setStrategy] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [proof, setProof] = useState<number | null>(null);
  const [editing, setEditing] = useState(searchParams?.get("edit") === "true");
  const [editForm, setEditForm] = useState({ title: "", concept: "", instrument: "", timeframe: "", description: "", accessTier: "", published: true });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/strategies/by-slug/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Strategy not found.");
        setStrategy(data);
      })
      .catch(() => {
        const fallback = staticStrategies.find(s => s.slug === slug);
        if (fallback) {
          setStrategy({
            id: fallback.slug,
            slug: fallback.slug,
            title: fallback.title,
            concept: fallback.concept,
            instrument: fallback.instrument,
            timeframe: fallback.timeframe,
            description: `A rules-based ${fallback.instrument} model. ${fallback.concept}.`,
            accessTier: fallback.access === "VIP" ? "vip" : "member",
            heroImage: null,
            proofImages: null,
            published: true,
            createdAt: new Date().toISOString(),
            backtest: {
              winRate: String(fallback.winRate),
              avgRR: String(fallback.rr),
              maxDrawdown: String(fallback.drawdown),
              totalTrades: fallback.trades,
              equityCurveData: null,
              trades: staticTrades.map((t, i) => ({
                id: String(i),
                date: new Date(2026, 5, 12 - i).toISOString(),
                pair: t[1],
                direction: t[2].toLowerCase() as "long" | "short",
                result: (t[3] === "BE" ? "breakeven" : t[3].toLowerCase()) as "win" | "loss" | "breakeven",
                rMultiple: t[4].replace(/[^0-9.\-+]/g, ""),
              })),
            },
          });
        } else {
          setError("Strategy not found.");
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  function startEdit() {
    if (!strategy) return;
    setEditForm({
      title: strategy.title,
      concept: strategy.concept,
      instrument: strategy.instrument,
      timeframe: strategy.timeframe,
      description: strategy.description,
      accessTier: strategy.accessTier,
      published: strategy.published,
    });
    setEditing(true);
  }

  async function handleSave() {
    if (!strategy) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/strategies/${strategy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed.");
      setStrategy({ ...strategy, ...editForm });
      setEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!strategy) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/strategies/${strategy.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Delete failed." }));
        throw new Error(data.error || "Delete failed.");
      }
      router.push("/strategies");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed.");
      setSaving(false);
    }
  }

  if (loading) return <div className="container-shell py-20" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}><CandleLoader label="Loading strategy" /></div>;
  if (error || !strategy) return <div className="container-shell py-20"><p className="error-text">{error || "Strategy not found."}</p><Link href="/strategies" className="mt-4 text-sm text-muted hover:text-paper">← Back to strategies</Link></div>;

  const trades = strategy.backtest?.trades || [];
  const visible = filter === "ALL" ? trades : trades.filter(t => t.result === filter.toLowerCase());
  const proofImages = strategy.proofImages || [];
  const backtest = strategy.backtest;
  const activeProof = proof !== null ? proofImages[proof] : null;

  return <div>
    <div className="border-b hairline">
      <div className="container-shell py-12">
        <Link href="/strategies" className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-muted hover:text-paper"><ArrowLeft size={13} /> STRATEGY LIBRARY</Link>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex gap-2">
              <span className="border border-profit/30 px-2 py-1 font-mono text-[9px] text-profit">VERIFIED SAMPLE</span>
              <span className="border hairline px-2 py-1 font-mono text-[9px] text-muted">
                {strategy.instrument} / {strategy.timeframe}
              </span>
            </div>
            <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold tracking-[-.055em] md:text-7xl">{strategy.title}</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">{strategy.description}</p>
          </div>
          <div className="flex items-end"><Button>GET FULL ACCESS</Button></div>
        </div>
      </div>
    </div>

    {isAdmin && !editing && (
      <div className="border-b hairline bg-white/[.02]">
        <div className="container-shell flex items-center gap-3 py-3">
          <span className="mr-auto text-[10px] font-bold tracking-wider text-muted">ADMIN</span>
          <button onClick={startEdit} className="flex items-center gap-2 rounded border border-white/10 px-3 py-1.5 text-xs text-muted transition hover:border-brass/50 hover:text-brass">
            <Pencil size={13} /> Edit
          </button>
          <button onClick={() => setDeleteConfirm(true)} className="flex items-center gap-2 rounded border border-white/10 px-3 py-1.5 text-xs text-muted transition hover:border-red-500/50 hover:text-red-400">
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    )}

    {isAdmin && editing && (
      <div className="border-b hairline bg-white/[.02]">
        <div className="container-shell py-6">
          <div className="flex items-center justify-between mb-5">
            <span className="text-[10px] font-bold tracking-wider text-brass">EDITING STRATEGY</span>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex items-center gap-1 rounded border border-white/10 px-3 py-1.5 text-xs text-muted hover:text-paper">
                <X size={13} /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 rounded border border-profit/50 px-3 py-1.5 text-xs text-profit hover:bg-profit/10 disabled:opacity-50">
                <Check size={13} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold tracking-wider text-muted">TITLE</label>
              <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="mt-1 w-full rounded border border-white/10 bg-transparent px-3 py-2 text-sm text-paper outline-none focus:border-brass/50" />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-wider text-muted">CONCEPT</label>
              <input value={editForm.concept} onChange={e => setEditForm(f => ({ ...f, concept: e.target.value }))} className="mt-1 w-full rounded border border-white/10 bg-transparent px-3 py-2 text-sm text-paper outline-none focus:border-brass/50" />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-wider text-muted">INSTRUMENT</label>
              <input value={editForm.instrument} onChange={e => setEditForm(f => ({ ...f, instrument: e.target.value }))} className="mt-1 w-full rounded border border-white/10 bg-transparent px-3 py-2 text-sm text-paper outline-none focus:border-brass/50" />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-wider text-muted">TIMEFRAME</label>
              <input value={editForm.timeframe} onChange={e => setEditForm(f => ({ ...f, timeframe: e.target.value }))} className="mt-1 w-full rounded border border-white/10 bg-transparent px-3 py-2 text-sm text-paper outline-none focus:border-brass/50" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold tracking-wider text-muted">DESCRIPTION</label>
              <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} className="mt-1 w-full rounded border border-white/10 bg-transparent px-3 py-2 text-sm text-paper outline-none focus:border-brass/50" />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-wider text-muted">ACCESS TIER</label>
              <select value={editForm.accessTier} onChange={e => setEditForm(f => ({ ...f, accessTier: e.target.value }))} className="mt-1 w-full rounded border border-white/10 bg-transparent px-3 py-2 text-sm text-paper outline-none focus:border-brass/50">
                <option value="free">Free</option>
                <option value="member">Member</option>
                <option value="vip">VIP</option>
              </select>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input type="checkbox" checked={editForm.published} onChange={e => setEditForm(f => ({ ...f, published: e.target.checked }))} className="accent-[#3fa796]" />
                Published
              </label>
            </div>
          </div>
        </div>
      </div>
    )}

    {deleteConfirm && (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-sm border hairline bg-[#0a1513] p-8 text-center">
          <Trash2 size={28} className="mx-auto text-red-400" />
          <h3 className="mt-4 font-display text-xl">Delete this strategy?</h3>
          <p className="mt-2 text-sm text-muted">This action cannot be undone. All associated data will be removed.</p>
          <div className="mt-6 flex gap-3 justify-center">
            <button onClick={() => setDeleteConfirm(false)} className="rounded border border-white/10 px-4 py-2 text-xs text-muted hover:text-paper">Cancel</button>
            <button onClick={handleDelete} disabled={saving} className="rounded border border-red-500/50 bg-red-500/10 px-4 py-2 text-xs text-red-400 hover:bg-red-500/20 disabled:opacity-50">{saving ? "Deleting…" : "Delete permanently"}</button>
          </div>
        </div>
      </div>
    )}

    <div className="container-shell grid items-start gap-10 py-14 lg:grid-cols-[1fr_285px]">
      <div className="min-w-0">
        {strategy.heroImage && (
          <Reveal>
            <section className="mb-16">
              <div className="eyebrow">Candle structure</div>
              <h2 className="mt-2 font-display text-2xl">{strategy.concept}</h2>
              <div className="mt-5 overflow-hidden border hairline rounded-sm">
                <Image
                  src={`/api/drive/image/${strategy.heroImage}`}
                  alt={`${strategy.title} candle structure`}
                  width={1200}
                  height={675}
                  unoptimized
                  className="w-full"
                  style={{ maxHeight: "500px", objectFit: "contain", background: "#0a1513" }}
                />
              </div>
            </section>
          </Reveal>
        )}

        {backtest && (
          <Reveal>
            <section>
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <div className="eyebrow">Backtest equity</div>
                  <h2 className="mt-2 font-display text-2xl">$100k model account</h2>
                </div>
                <div className="font-mono text-xs text-muted">
                  {backtest.totalTrades} trades
                </div>
              </div>
              <div className="border hairline bg-panel/50 p-4 md:p-6">
                <EquityChart data={Array.isArray(backtest.equityCurveData) ? backtest.equityCurveData as Array<{ trade?: number; value?: number; equity?: number }> : null} />
              </div>
            </section>
          </Reveal>
        )}

        {trades.length > 0 && (
          <Reveal>
            <section className="mt-16">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="eyebrow">Complete sample</div>
                  <h2 className="mt-2 font-display text-3xl">Trade log</h2>
                </div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={14} className="text-muted" />
                  {["ALL", "WIN", "LOSS"].map(x => (
                    <button onClick={() => setFilter(x)} key={x} className={`px-3 py-2 font-mono text-[9px] ${filter === x ? "bg-white/10 text-paper" : "text-muted"}`}>{x}</button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto border-t hairline">
                <table className="w-full min-w-[650px] text-left">
                  <thead>
                    <tr>
                      {["DATE", "PAIR", "DIRECTION", "OUTCOME", "RETURN"].map(x => (
                        <th key={x} className="border-b hairline py-4 font-mono text-[9px] font-medium tracking-wider text-muted">{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(t => (
                      <tr key={t.id} className="group border-b hairline text-xs hover:bg-white/[.02]">
                        <td className="py-4 font-mono text-paper">{formatTradeDate(t.date)}</td>
                        <td className="py-4 font-mono text-paper">{t.pair}</td>
                        <td className="py-4 font-mono text-paper">
                          <span className={`mr-2 inline-block size-1.5 rounded-full ${t.direction === "long" ? "bg-profit" : "bg-loss"}`} />
                          {t.direction.toUpperCase()}
                        </td>
                        <td className={`py-4 font-mono ${t.result === "win" ? "text-profit" : t.result === "loss" ? "text-loss" : "text-muted"}`}>
                          {t.result.toUpperCase()}
                        </td>
                        <td className={`py-4 font-mono ${Number(t.rMultiple) >= 0 ? "text-profit" : "text-loss"}`}>
                          {formatR(t.rMultiple)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </Reveal>
        )}

        <Reveal>
          <section className="mt-16">
            <div className="eyebrow">Annotated proof</div>
            <h2 className="mt-2 font-display text-3xl">Execution gallery</h2>
            {proofImages.length > 0 ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {proofImages.map((img, i) => (
                  <button onClick={() => setProof(i)} key={i} className="group relative aspect-[4/3] overflow-hidden border hairline text-left">
                    <Image
                      src={`/api/drive/image/${img.fileId}`}
                      alt={img.label}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      unoptimized
                      className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute inset-x-4 bottom-4 flex justify-between items-end">
                      <div>
                        <span className={`font-mono text-[9px] ${img.direction === "LONG" ? "text-profit" : "text-loss"}`}>
                          {img.rMultiple} / {img.direction}
                        </span>
                      </div>
                      <Expand size={13} className="text-muted" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="group relative aspect-[4/3] overflow-hidden border hairline grid-lines">
                    <div className={`absolute inset-0 opacity-40 ${i === 1 ? "bg-[radial-gradient(circle_at_30%_70%,rgba(181,71,60,.5),transparent_38%)]" : "bg-[radial-gradient(circle_at_65%_35%,rgba(63,167,150,.5),transparent_38%)]"}`} />
                    <div className="absolute inset-x-4 bottom-4 flex justify-between font-mono text-[9px] text-muted">
                      <span>SETUP / 0{i + 1}</span>
                      <Expand size={13} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Reveal>
      </div>

      <aside className="sticky top-24 border hairline bg-panel/60">
        <div className="border-b hairline p-5"><div className="eyebrow">Model statistics</div></div>
        <div className="grid grid-cols-2 gap-y-7 p-5">
          <StatCounter value={backtest ? Number(backtest.winRate) : 0} decimals={1} suffix="%" label="Win rate" />
          <StatCounter value={backtest ? Number(backtest.avgRR) : 0} decimals={2} suffix="R" label="Avg R:R" />
          <StatCounter value={backtest ? Number(backtest.maxDrawdown) : 0} decimals={1} suffix="%" label="Max drawdown" />
          <StatCounter value={backtest ? backtest.totalTrades : 0} label="Total trades" />
        </div>
        <div className="border-t hairline p-5">
          <ul className="space-y-3 text-xs text-muted">
            {["Spread included", "Session rules fixed", "No removed losses", "CSV export included"].map(x => (
              <li className="flex gap-2" key={x}><Check size={14} className="text-profit" />{x}</li>
            ))}
          </ul>
          <Button variant="outline" className="mt-6 w-full"><Download size={14} className="mr-2 inline" /> BACKTEST PDF</Button>
          <div className="mt-4 flex items-center justify-center gap-2 text-[9px] text-muted"><LockKeyhole size={11} /> MEMBER ACCESS REQUIRED</div>
        </div>
      </aside>
    </div>

    <Modal open={proof !== null} onClose={() => setProof(null)}>
      {activeProof ? (
        <div>
          <div className="overflow-hidden" style={{ maxHeight: "50vh" }}>
            <Image
              src={`/api/drive/image/${activeProof.fileId}`}
              alt={activeProof.label}
              width={1200}
              height={675}
              unoptimized
              className="w-full"
              style={{ objectFit: "contain", background: "#0a1513" }}
            />
          </div>
          <div className="p-8">
            <div className={`font-mono text-xs ${activeProof.direction === "LONG" ? "text-profit" : "text-loss"}`}>
              {activeProof.rMultiple} / {activeProof.direction}
            </div>
            <h3 className="mt-2 font-display text-3xl">{activeProof.label}</h3>
            {activeProof.description && (
              <p className="mt-3 max-w-xl text-sm text-muted">{activeProof.description}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="aspect-video grid-lines">
          <div className="flex h-full flex-col justify-end bg-[linear-gradient(150deg,transparent,rgba(63,167,150,.12))] p-8">
            <div className="font-mono text-xs text-profit">SETUP</div>
            <h3 className="mt-2 font-display text-3xl">No proof uploaded yet</h3>
          </div>
        </div>
      )}
    </Modal>
  </div>;
}
