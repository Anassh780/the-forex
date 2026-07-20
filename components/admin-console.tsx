"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { BarChart3, BookOpen, CloudUpload, CreditCard, FolderOpen, ImagePlus, LifeBuoy, Link2, Shield, ShieldAlert, Trash2, Users, UsersRound } from "lucide-react";
import { ContentUploader } from "@/components/content-uploader";
import { CandleLoader } from "@/components/candle-loader";
import { DriveManager } from "@/components/drive-manager";
import { AdvancedUsersManager, CommunityManager, PlansManager, SecurityManager, TicketsManager } from "@/components/admin-platform-managers";

type ProviderStatus = {
  connected?: boolean;
  accountEmail?: string | null;
  accountName?: string | null;
  bucket?: string | null;
  folder?: string | null;
  error?: string;
  missing?: string[];
};

type StorageStatus = { firebase?: ProviderStatus; drive?: ProviderStatus; error?: string };

type ProofImage = {
  fileId: string;
  label: string;
  rMultiple: string;
  direction: string;
  description: string;
};

type Strategy = {
  id: string;
  title: string;
  slug: string;
  accessTier: string;
  published: boolean;
  createdAt: string;
  heroImage: string | null;
  proofImages: ProofImage[] | null;
};

type DriveCourse = {
  id: string;
  name: string;
  modifiedTime?: string;
  videoCount: number;
  coverId: string | null;
};

type DriveCourseFile = {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function useAdminData<T>(endpoint: string, active: boolean) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    setError("");
    void fetch(endpoint, { cache: "no-store" })
      .then(async response => {
        const text = await response.text();
        const data = text ? JSON.parse(text) : null;
        if (!response.ok) throw new Error(data?.error || "Unable to load data.");
        return Array.isArray(data) ? data : [];
      })
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load data."))
      .finally(() => setLoading(false));
  }, [endpoint, active]);

  const refresh = async () => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      if (!response.ok) throw new Error(data?.error || "Unable to refresh data.");
      setItems(Array.isArray(data) ? data : []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to refresh data.");
    }
  };

  return { items, loading, error, refresh };
}

const ACCESS_TIERS = [
  { value: "free", label: "Free" },
  { value: "member", label: "Member" },
  { value: "vip", label: "VIP" },
  { value: "admin", label: "Admin" },
];

const emptyStrategyForm = {
  title: "",
  slug: "",
  concept: "",
  instrument: "",
  timeframe: "",
  accessTier: "member",
  description: "",
  published: true,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CHUNK_SIZE = 10 * 1024 * 1024;

async function uploadToDrive(
  file: File,
  onProgress: (pct: number) => void,
  options: { parentId?: string; fileName?: string; preserveName?: boolean } = {},
): Promise<string> {
  const contentType = file.type || "application/octet-stream";
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "google-drive",
      fileName: options.fileName || file.name,
      fileSize: file.size,
      contentType,
      parentId: options.parentId,
      preserveName: options.preserveName,
    }),
  });
  const data = await res.json() as { error?: string; upload?: { uploadUrl?: string; fileName?: string } };
  if (!res.ok || !data.upload?.uploadUrl) throw new Error(data.error || "Upload link failed.");

  const uploadUrl = data.upload.uploadUrl;

  let fileId: string | undefined;

  for (let start = 0; start < file.size; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const chunkRes = await fetch("/api/uploads/chunk", {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
        "Content-Length": String(end - start),
        "x-upload-url": uploadUrl,
      },
      body: chunk,
    });
    if (!chunkRes.ok) {
      const err = await chunkRes.json().catch(() => ({ error: "Upload failed." })) as { error?: string };
      throw new Error(err.error || `Upload rejected (${chunkRes.status})`);
    }
    const chunkData = await chunkRes.json() as { ok?: boolean; status?: number; file?: { id?: string; name?: string } };
    if (chunkData.file?.id) fileId = chunkData.file.id;
    onProgress(Math.min(99, Math.round((end / file.size) * 100)));
  }

  onProgress(100);
  if (!fileId) throw new Error("Upload completed but no file ID was returned.");
  return fileId;
}

function StrategyImageManager({ strategy, onBack }: { strategy: Strategy; onBack: () => void }) {
  const heroInput = useRef<HTMLInputElement>(null);
  const proofInput = useRef<HTMLInputElement>(null);
  const [heroImage, setHeroImage] = useState<string | null>(strategy.heroImage);
  const [proofImages, setProofImages] = useState<ProofImage[]>(strategy.proofImages || []);
  const [uploading, setUploading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [newProof, setNewProof] = useState({ label: "", rMultiple: "", direction: "LONG", description: "" });

  const save = useCallback(async (hero: string | null, proofs: ProofImage[]) => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`/api/strategies/${strategy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroImage: hero, proofImages: proofs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setSaveStatus({ type: "success", text: "Images saved." });
    } catch (err) {
      setSaveStatus({ type: "error", text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }, [strategy.id]);

  async function handleHeroUpload(file: File) {
    setUploading("hero");
    setProgress(0);
    try {
      const fileId = await uploadToDrive(file, setProgress);
      setHeroImage(fileId);
      await save(fileId, proofImages);
    } catch (err) {
      setSaveStatus({ type: "error", text: err instanceof Error ? err.message : "Hero upload failed." });
    } finally {
      setUploading(null);
    }
  }

  async function handleProofUpload(file: File) {
    if (!newProof.label.trim()) {
      setSaveStatus({ type: "error", text: "Add a setup label before uploading." });
      return;
    }
    setUploading("proof");
    setProgress(0);
    try {
      const fileId = await uploadToDrive(file, setProgress);
      const entry: ProofImage = {
        fileId,
        label: newProof.label.trim(),
        rMultiple: newProof.rMultiple.trim() || "+0.00R",
        direction: newProof.direction,
        description: newProof.description.trim(),
      };
      const updated = [...proofImages, entry];
      setProofImages(updated);
      setNewProof({ label: "", rMultiple: "", direction: "LONG", description: "" });
      await save(heroImage, updated);
    } catch (err) {
      setSaveStatus({ type: "error", text: err instanceof Error ? err.message : "Proof upload failed." });
    } finally {
      setUploading(null);
    }
  }

  function removeProof(index: number) {
    const updated = proofImages.filter((_, i) => i !== index);
    setProofImages(updated);
    void save(heroImage, updated);
  }

  function removeHero() {
    setHeroImage(null);
    void save(null, proofImages);
  }

  return <section className="admin-section">
    <div className="admin-section-head">
      <div>
        <button type="button" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "12px", padding: "8px 14px", border: "1px solid rgba(255,255,255,.1)", borderRadius: "8px", background: "transparent", color: "#d5ddd9", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
          ← Back to strategies
        </button>
        <h2>{strategy.title}</h2>
        <p>Upload candle structure images and backtesting proof for this strategy.</p>
      </div>
      <div className="admin-section-stats">
        <span className={`status-pill ${strategy.published ? "live" : "draft"}`}>{strategy.published ? "Published" : "Draft"}</span>
      </div>
    </div>

    <div className="admin-grid">
      <div className="admin-card admin-card-form">
        <div className="admin-card-head">
          <h3>Main candle structure</h3>
          <span className="admin-badge accent">Hero image</span>
        </div>

        {heroImage ? (
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <Image
              src={`/api/drive/image/${heroImage}`}
              alt="Strategy candle structure"
              width={1200}
              height={675}
              unoptimized
              style={{ width: "100%", borderRadius: "10px", border: "1px solid rgba(255,255,255,.08)" }}
            />
            <button type="button" onClick={removeHero} style={{ position: "absolute", top: "8px", right: "8px", display: "grid", placeItems: "center", width: "32px", height: "32px", border: "1px solid rgba(255,120,110,.4)", borderRadius: "8px", background: "rgba(0,0,0,.7)", color: "#ff8883", cursor: "pointer" }}>
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => heroInput.current?.click()}
            disabled={uploading !== null}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", width: "100%", minHeight: "180px", marginBottom: "16px", border: "1px dashed rgba(155,245,106,.25)", borderRadius: "12px", background: "rgba(155,245,106,.03)", color: "#8d9b96", cursor: uploading ? "not-allowed" : "pointer" }}
          >
            <ImagePlus size={28} style={{ color: "var(--lime)", opacity: 0.7 }} />
            <strong style={{ fontSize: "13px" }}>{uploading === "hero" ? `Uploading… ${progress}%` : "Upload candle structure image"}</strong>
            <small style={{ fontSize: "10px", color: "#6d8481" }}>This image appears at the top of the strategy page</small>
          </button>
        )}
        <input ref={heroInput} type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) void handleHeroUpload(e.target.files[0]); e.target.value = ""; }} />

        {uploading === "hero" && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ height: "4px", borderRadius: "999px", background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, borderRadius: "999px", background: "linear-gradient(90deg, var(--lime), var(--mint))", transition: "width .2s ease" }} />
            </div>
          </div>
        )}

        <div className="admin-card-head" style={{ marginTop: "24px" }}>
          <h3>Backtesting proof</h3>
          <span className="admin-badge">{proofImages.length} setups</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
          <label>
            <span>Setup label</span>
            <input value={newProof.label} onChange={e => setNewProof(p => ({ ...p, label: e.target.value }))} placeholder="Asian low sweep → displacement" />
          </label>
          <div className="field-row">
            <label>
              <span>R-Multiple</span>
              <input value={newProof.rMultiple} onChange={e => setNewProof(p => ({ ...p, rMultiple: e.target.value }))} placeholder="+2.40R" />
            </label>
            <label>
              <span>Direction</span>
              <select value={newProof.direction} onChange={e => setNewProof(p => ({ ...p, direction: e.target.value }))}>
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </select>
            </label>
          </div>
          <label>
            <span>Description</span>
            <textarea rows={3} value={newProof.description} onChange={e => setNewProof(p => ({ ...p, description: e.target.value }))} placeholder="Explain the trade setup, entry, and outcome." />
          </label>
          <button
            type="button"
            onClick={() => proofInput.current?.click()}
            disabled={uploading !== null || !newProof.label.trim()}
            style={{ width: "100%", padding: "12px", border: "1px dashed rgba(155,245,106,.3)", borderRadius: "8px", background: uploading === "proof" ? "rgba(155,245,106,.08)" : "rgba(155,245,106,.04)", color: uploading === "proof" ? "var(--lime)" : "#d5ddd9", fontSize: "13px", fontWeight: 600, cursor: uploading || !newProof.label.trim() ? "not-allowed" : "pointer", opacity: !newProof.label.trim() ? 0.5 : 1 }}
          >
            <ImagePlus size={14} style={{ display: "inline", marginRight: "8px", verticalAlign: "middle" }} />
            {uploading === "proof" ? `Uploading… ${progress}%` : "Upload proof image"}
          </button>
          <input ref={proofInput} type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) void handleProofUpload(e.target.files[0]); e.target.value = ""; }} />
        </div>

        {uploading === "proof" && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ height: "4px", borderRadius: "999px", background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, borderRadius: "999px", background: "linear-gradient(90deg, var(--lime), var(--mint))", transition: "width .2s ease" }} />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => void save(heroImage, proofImages)}
          disabled={saving || uploading !== null}
          style={{ width: "100%", marginTop: "16px", padding: "14px", border: "none", borderRadius: "10px", background: saving ? "rgba(155,245,106,.15)" : "linear-gradient(135deg, var(--lime), var(--mint))", color: saving ? "var(--lime)" : "#0a0f0d", fontSize: "14px", fontWeight: 700, cursor: saving || uploading ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>

        {saveStatus && <p className={`admin-message ${saveStatus.type}`}>{saveStatus.text}</p>}
      </div>

      <div className="admin-card admin-card-list">
        <div className="admin-card-head"><h3>Uploaded setups</h3><span className="admin-badge">{proofImages.length}</span></div>
        {proofImages.length === 0 ? (
          <div className="admin-empty">
            <strong>No proof images yet</strong>
            <small>Fill in the setup details and upload a screenshot to add proof.</small>
          </div>
        ) : (
          <div className="admin-list">
            {proofImages.map((img, i) => (
              <div key={i} className="strategy-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: img.direction === "LONG" ? "var(--lime)" : "#ff8883" }}>{img.rMultiple} / {img.direction}</span>
                    </div>
                    <strong style={{ display: "block", fontSize: "14px" }}>{img.label}</strong>
                    {img.description && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#8d9b96", lineHeight: "1.5" }}>{img.description}</p>}
                  </div>
                  <button type="button" onClick={() => removeProof(i)} style={{ flexShrink: 0, display: "grid", placeItems: "center", width: "30px", height: "30px", border: "1px solid rgba(255,120,110,.3)", borderRadius: "6px", background: "transparent", color: "#ff8883", cursor: "pointer" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <Image
                  src={`/api/drive/image/${img.fileId}`}
                  alt={img.label}
                  width={640}
                  height={360}
                  unoptimized
                  style={{ width: "100%", maxHeight: "160px", objectFit: "cover", borderRadius: "8px", border: "1px solid rgba(255,255,255,.06)" }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </section>;
}

function StrategyManager() {
  const { items: strategies, loading, error: dataError, refresh } = useAdminData<Strategy>("/api/strategies", true);
  const [form, setForm] = useState(emptyStrategyForm);
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);

  const update = <K extends keyof typeof emptyStrategyForm>(key: K, value: (typeof emptyStrategyForm)[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  function onTitleChange(value: string) {
    setForm(prev => ({ ...prev, title: value, slug: slugEdited ? prev.slug : slugify(value) }));
  }

  const publishedCount = useMemo(() => strategies.filter(item => item.published).length, [strategies]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setSaving(true);
    try {
      const response = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          slug: form.slug.trim() || slugify(form.title),
          concept: form.concept.trim() || "Admin published strategy",
          instrument: form.instrument.trim() || "Multi-market",
          timeframe: form.timeframe.trim() || "1H",
          description: form.description.trim(),
          accessTier: form.accessTier,
          published: form.published,
        }),
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(result.error || "Unable to save strategy.");
      setForm(emptyStrategyForm);
      setSlugEdited(false);
      setStatus({ type: "success", text: `"${result.title || form.title}" ${form.published ? "published" : "saved as draft"}.` });
      await refresh();
    } catch (reason) {
      setStatus({ type: "error", text: reason instanceof Error ? reason.message : "Unable to save strategy." });
    } finally {
      setSaving(false);
    }
  }

  if (editingStrategy) {
    return <StrategyImageManager
      strategy={editingStrategy}
      onBack={() => { setEditingStrategy(null); void refresh(); }}
    />;
  }

  return <section className="admin-section admin-strategies">
    <div className="admin-section-head">
      <div>
        <h2>Strategy management</h2>
        <p>Create, review, and publish new strategy entries.</p>
      </div>
      <div className="admin-section-stats">
        <span><strong>{strategies.length}</strong> total</span>
        <span><strong>{publishedCount}</strong> published</span>
      </div>
    </div>

    <div className="admin-grid">
      <div className="admin-card admin-card-form">
        <div className="admin-card-head"><h3>New strategy</h3><span className="admin-badge accent">Draft builder</span></div>
        <form onSubmit={submit}>
          <label>
            <span>Title</span>
            <input value={form.title} onChange={event => onTitleChange(event.target.value)} placeholder="London Liquidity Reversal" required />
          </label>
          <label>
            <span>Slug</span>
            <input
              value={form.slug}
              onChange={event => { setSlugEdited(true); update("slug", event.target.value); }}
              placeholder="london-liquidity-reversal"
              required
            />
            <em className="field-hint">Used in the public URL. Auto-filled from the title.</em>
          </label>
          <div className="field-row">
            <label>
              <span>Instrument</span>
              <input value={form.instrument} onChange={event => update("instrument", event.target.value)} placeholder="GBP/USD" />
            </label>
            <label>
              <span>Timeframe</span>
              <input value={form.timeframe} onChange={event => update("timeframe", event.target.value)} placeholder="5M" />
            </label>
          </div>
          <label>
            <span>Concept</span>
            <input value={form.concept} onChange={event => update("concept", event.target.value)} placeholder="Liquidity sweep + MSS" />
          </label>
          <label>
            <span>Access tier</span>
            <select value={form.accessTier} onChange={event => update("accessTier", event.target.value)}>
              {ACCESS_TIERS.map(tier => <option key={tier.value} value={tier.value}>{tier.label}</option>)}
            </select>
          </label>
          <label>
            <span>Description</span>
            <textarea rows={4} value={form.description} onChange={event => update("description", event.target.value)} placeholder="Explain the setup, entry model, and risk approach." required />
          </label>
          <label className="field-toggle">
            <input type="checkbox" checked={form.published} onChange={event => update("published", event.target.checked)} />
            <span>Publish immediately<em>Uncheck to save as a draft that members can’t see.</em></span>
          </label>
          <button type="submit" disabled={saving}>{saving ? "Saving…" : form.published ? "Publish strategy" : "Save draft"}</button>
          {status && <p className={`admin-message ${status.type}`}>{status.text}</p>}
        </form>
      </div>

      <div className="admin-card admin-card-list">
        <div className="admin-card-head"><h3>All strategies</h3>{!loading && !dataError && <span className="admin-badge">{strategies.length}</span>}</div>
        {loading ? (
          <div className="admin-empty"><CandleLoader size="sm" label="Loading strategies" /></div>
        ) : dataError ? (
          <div className="admin-empty error">
            <p className="error-text">{dataError}</p>
            <button type="button" className="admin-retry" onClick={() => void refresh()}>Try again</button>
          </div>
        ) : strategies.length === 0 ? (
          <div className="admin-empty">
            <strong>No strategies yet</strong>
            <small>Publish your first strategy with the form on the left.</small>
          </div>
        ) : (
          <div className="admin-list">
            {strategies.map(item => (
              <button key={item.id} type="button" className="strategy-row" onClick={() => setEditingStrategy(item)} style={{ cursor: "pointer", width: "100%", textAlign: "left", background: "transparent" }}>
                <div className="strategy-row-main">
                  <strong>{item.title}</strong>
                  <span className="strategy-slug">/{item.slug}</span>
                </div>
                <div className="strategy-row-meta">
                  <span className={`tier-badge tier-${item.accessTier}`}>{item.accessTier}</span>
                  <span className={`status-pill ${item.published ? "live" : "draft"}`}>{item.published ? "Published" : "Draft"}</span>
                  <small>{formatDate(item.createdAt)}</small>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  </section>;
}

function DriveConnectPrompt({ title, description }: { title: string; description: string }) {
  return <section className="admin-section">
    <div className="admin-section-head">
      <div><h2>{title}</h2><p>{description}</p></div>
    </div>
    <div className="admin-empty">
      <strong>Google Drive is not connected</strong>
      <small>Authorize Drive once with an administrator Google account. Vercel will store the connection securely in Turso.</small>
      <a className="connection-button" href="/api/google-drive/connect?mode=drive" style={{ marginTop: 14 }}>
        <Link2 size={14} /> Connect Drive
      </a>
    </div>
  </section>;
}

function CoursesManager({ connected, checking }: { connected?: boolean; checking?: boolean }) {
  const [courses, setCourses] = useState<DriveCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!connected) {
      setCourses([]);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/drive/folders", { cache: "no-store" });
      const result = await response.json() as { error?: string; folders?: Array<{ id: string; name: string; modifiedTime?: string }> };
      if (!response.ok) throw new Error(result.error || "Unable to load Drive course folders.");

      const folderDetails = await Promise.all((result.folders || []).map(async folder => {
        const detailResponse = await fetch(`/api/drive/folders?id=${encodeURIComponent(folder.id)}`, { cache: "no-store" });
        const detail = await detailResponse.json() as { error?: string; files?: DriveCourseFile[] };
        if (!detailResponse.ok) throw new Error(detail.error || `Unable to inspect ${folder.name}.`);
        const files = detail.files || [];
        const covers = files
          .filter(file => /^(?:\d{2,3}\s*[·.\-–]\s*)?cover\b/i.test(file.name) && (file.mimeType || "").startsWith("image/"))
          .sort((a, b) => Date.parse(b.modifiedTime || "") - Date.parse(a.modifiedTime || ""));
        return {
          ...folder,
          videoCount: files.filter(file => (file.mimeType || "").startsWith("video/")).length,
          coverId: covers[0]?.id || null,
        };
      }));

      setCourses(folderDetails);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Drive course folders.");
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    if (connected) void refresh();
    else if (!checking) {
      setCourses([]);
      setError("");
      setLoading(false);
    }
  }, [connected, checking, refresh]);

  async function handleCoverUpload(course: DriveCourse, file: File) {
    setUploadingId(course.id);
    setUploadProgress(0);
    setMessage(null);
    try {
      const extension = file.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() || ".jpg";
      const fileId = await uploadToDrive(file, setUploadProgress, {
        parentId: course.id,
        fileName: `cover${extension}`,
        preserveName: true,
      });

      if (course.coverId && course.coverId !== fileId) {
        await fetch("/api/drive/files", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: course.coverId }),
        });
      }

      setMessage({ type: "success", text: `Cover updated for ${course.name}.` });
      await refresh();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Cover upload failed." });
    } finally {
      setUploadingId(null);
    }
  }

  if (checking) {
    return <section className="admin-section admin-courses">
      <div className="admin-section-head">
        <div><h2>Drive courses</h2><p>Checking your Google Drive connection.</p></div>
      </div>
      <div className="admin-empty"><CandleLoader size="sm" label="Checking Drive" /></div>
    </section>;
  }

  if (!connected) {
    return <DriveConnectPrompt title="Drive courses" description="Connect Google Drive before loading course folders and cover images." />;
  }

  return <section className="admin-section admin-courses">
    <div className="admin-section-head">
      <div><h2>Drive courses</h2><p>Only real course folders inside your connected Google Drive library appear here.</p></div>
      {!loading && !error && <div className="admin-section-stats"><span className="admin-badge accent">{courses.length} live folder{courses.length === 1 ? "" : "s"}</span></div>}
    </div>
    {message && <p className={`admin-message ${message.type}`}>{message.text}</p>}
    {loading ? <div className="admin-empty"><CandleLoader size="sm" label="Loading Drive courses" /></div> : error ? <div className="admin-empty error"><p className="error-text">{error}</p><button type="button" className="admin-retry" onClick={() => void refresh()}>Try again</button></div> : courses.length === 0 ? <div className="admin-empty"><strong>No Drive course folders found</strong><small>Create a course folder in Content Library, then return here to upload its cover.</small></div> : <div className="admin-course-grid">
      {courses.map(course => <article key={course.id} className="admin-course-card">
        <div className="admin-course-cover">
          {course.coverId ? <Image src={`/api/drive/image/${course.coverId}`} alt={`${course.name} cover`} fill sizes="(max-width: 720px) 100vw, 360px" unoptimized /> : <div className="admin-course-cover-empty"><BookOpen size={34} /><span>No cover uploaded</span></div>}
          <span className="admin-course-live"><span /> Drive live</span>
        </div>
        <div className="admin-course-body">
          <div><h3>{course.name}</h3><p>{course.videoCount} video lesson{course.videoCount === 1 ? "" : "s"}{course.modifiedTime ? ` · Updated ${formatDate(course.modifiedTime)}` : ""}</p></div>
          {uploadingId === course.id ? <div className="admin-cover-progress"><span>{uploadProgress}%</span><div><i style={{ width: `${uploadProgress}%` }} /></div></div> : <button type="button" className="admin-cover-button" onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/png,image/jpeg,image/webp";
            input.onchange = () => { if (input.files?.[0]) void handleCoverUpload(course, input.files[0]); };
            input.click();
          }}><ImagePlus size={15} />{course.coverId ? "Change cover" : "Upload cover"}</button>}
        </div>
      </article>)}
    </div>}
  </section>;
}

export function AdminConsole() {
  const [tab, setTab] = useState("Content library");
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      setStatusLoading(true);
      try {
        const response = await fetch("/api/storage/status", { cache: "no-store" });
        const result = await response.json();
        setStorageStatus(response.ok ? result : { error: result.error || "Unable to load storage status." });
      } catch {
        setStorageStatus({ error: "Unable to load storage status." });
      } finally {
        setStatusLoading(false);
      }
    };

    void fetchStatus();
  }, []);

  const driveConnected = storageStatus?.drive?.connected;
  const firebaseConnected = storageStatus?.firebase?.connected;

  const navItems = [
    { key: "Content library", label: "Content Library", Icon: FolderOpen },
    { key: "Content storage", label: "Upload Center", Icon: CloudUpload },
    { key: "Strategies", label: "Strategies", Icon: BarChart3 },
    { key: "Courses", label: "Courses", Icon: BookOpen },
    { key: "Users", label: "Users", Icon: Users },
    { key: "Community", label: "Community", Icon: UsersRound },
    { key: "Plans", label: "Plans & Offers", Icon: CreditCard },
    { key: "Tickets", label: "Support Tickets", Icon: LifeBuoy },
    { key: "Security", label: "Security", Icon: ShieldAlert },
  ];

  return <div className="admin-panel">
    {/* Sidebar */}
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <Shield size={18} />
        <span>Admin</span>
      </div>

      <nav className="admin-sidebar-nav">
        {navItems.map(({ key, label, Icon }) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="admin-sidebar-status">
        <div className="admin-sidebar-status-item">
          <span className={`admin-dot ${driveConnected ? "live" : "off"}`} />
          <span>Drive</span>
          <span className="admin-sidebar-status-val">{statusLoading ? "…" : driveConnected ? "Live" : "Off"}</span>
        </div>
        <div className="admin-sidebar-status-item">
          <span className={`admin-dot ${firebaseConnected ? "live" : "off"}`} />
          <span>Firebase</span>
          <span className="admin-sidebar-status-val">{statusLoading ? "…" : firebaseConnected ? "Live" : "Off"}</span>
        </div>
      </div>
    </aside>

    {/* Main area */}
    <div className="admin-main">
      {/* Top bar */}
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <h1>{navItems.find(n => n.key === tab)?.label || tab}</h1>
          <span className="admin-topbar-breadcrumb">Admin / {tab}</span>
        </div>
        <div className="admin-topbar-right">
          <div className="admin-health">
            {statusLoading ? (
              <span className="admin-health-dot loading" />
            ) : storageStatus?.error ? (
              <><span className="admin-health-dot error" /><span>Degraded</span></>
            ) : (
              <><span className="admin-health-dot ok" /><span>Systems healthy</span></>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="admin-content">
        {tab === "Content storage" && <ContentUploader />}
        {tab === "Content library" && <DriveManager connected={driveConnected} checking={statusLoading} />}
        {tab === "Strategies" && <StrategyManager />}
        {tab === "Courses" && <CoursesManager connected={driveConnected} checking={statusLoading} />}
        {tab === "Users" && <AdvancedUsersManager />}
        {tab === "Community" && <CommunityManager />}
        {tab === "Plans" && <PlansManager />}
        {tab === "Tickets" && <TicketsManager />}
        {tab === "Security" && <SecurityManager />}
      </div>
    </div>
  </div>;
}
