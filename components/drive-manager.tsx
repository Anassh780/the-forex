"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ChevronRight,
  FileVideo,
  Film,
  FolderClosed,
  FolderInput,
  FolderPlus,
  Link2,
  MoreVertical,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { CandleLoader } from "@/components/candle-loader";
import { SecureVideoPlayer } from "@/components/secure-video-player";

type DriveEntry = {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  videoMediaMetadata?: { durationMillis?: string; width?: number; height?: number };
};

type Folder = { id: string; name: string; modifiedTime?: string };

const CHUNK_SIZE = 10 * 1024 * 1024;
const isFolder = (e: { mimeType?: string }) => e.mimeType === "application/vnd.google-apps.folder";
const isVideo = (e: { mimeType?: string }) => (e.mimeType || "").startsWith("video/");

function bytes(value?: string | number) {
  let amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit++; }
  return `${amount >= 100 || unit === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`;
}

function duration(ms?: string) {
  const total = Number(ms);
  if (!Number.isFinite(total) || total <= 0) return "";
  const secs = Math.round(total / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Resumable chunk upload to a Google Drive session URL.
function sendChunk(url: string, chunk: Blob, start: number, total: number, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.open("PUT", url);
    req.setRequestHeader("Content-Range", `bytes ${start}-${start + chunk.size - 1}/${total}`);
    req.upload.onprogress = e => onProgress(e.loaded);
    req.onload = () => ([200, 201, 308].includes(req.status) ? resolve() : reject(new Error(`Drive rejected the upload (${req.status}).`)));
    req.onerror = () => reject(new Error("The connection dropped during upload."));
    req.send(chunk);
  });
}

export function DriveManager({ connected, checking }: { connected?: boolean; checking?: boolean }) {
  const [rootId, setRootId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [current, setCurrent] = useState<Folder | null>(null); // null = root
  const [entries, setEntries] = useState<DriveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DriveEntry | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [upload, setUpload] = useState<{ name: string; percent: number } | null>(null);
  const [rootFiles, setRootFiles] = useState<DriveEntry[]>([]); // loose files at the content root
  const [moving, setMoving] = useState<DriveEntry | null>(null); // item being moved (picker open)
  const fileInput = useRef<HTMLInputElement>(null);

  const loadRoot = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/drive/folders", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load Drive.");
      setRootId(data.rootId);
      setFolders(data.folders || []);
      // Also load loose files sitting directly in the content root so nothing is hidden.
      if (data.rootId) {
        try {
          const contents = await fetch(`/api/drive/folders?id=${encodeURIComponent(data.rootId)}`, { cache: "no-store" });
          const body = await contents.json();
          setRootFiles((body.files || []).filter((f: DriveEntry) => !isFolder(f)));
        } catch { setRootFiles([]); }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Drive.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFolder = useCallback(async (folder: Folder | null) => {
    setLoading(true);
    setError("");
    setCurrent(folder);
    try {
      const url = folder ? `/api/drive/folders?id=${encodeURIComponent(folder.id)}` : "/api/drive/folders";
      if (!folder) { await loadRoot(); return; }
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to open folder.");
      setEntries(data.files || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open folder.");
    } finally {
      setLoading(false);
    }
  }, [loadRoot]);

  useEffect(() => {
    if (connected) void loadRoot();
    else if (!checking) {
      setLoading(false);
      setError("");
      setFolders([]);
      setEntries([]);
      setRootFiles([]);
      setRootId(null);
      setCurrent(null);
    }
  }, [connected, checking, loadRoot]);

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setBusy("folder");
    try {
      const res = await fetch("/api/drive/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: current?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to create folder.");
      setNewFolderName("");
      setCreatingFolder(false);
      current ? await loadFolder(current) : await loadRoot();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create folder.");
    } finally {
      setBusy("");
    }
  }

  async function rename(entry: DriveEntry | Folder) {
    const next = window.prompt("Rename to:", entry.name);
    if (!next || next.trim() === entry.name) return;
    setBusy(entry.id);
    try {
      const res = await fetch("/api/drive/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, name: next.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to rename.");
      current ? await loadFolder(current) : await loadRoot();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to rename.");
    } finally {
      setBusy(""); setMenuId(null);
    }
  }

  async function remove(entry: DriveEntry | Folder) {
    const kind = isFolder(entry as DriveEntry) ? "folder and everything inside it" : "file";
    if (!window.confirm(`Move this ${kind} to Drive trash? "${entry.name}"`)) return;
    setBusy(entry.id);
    try {
      const res = await fetch("/api/drive/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to delete.");
      current ? await loadFolder(current) : await loadRoot();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete.");
    } finally {
      setBusy(""); setMenuId(null);
    }
  }

  async function moveTo(entry: DriveEntry, targetId?: string) {
    setBusy(entry.id);
    try {
      const res = await fetch("/api/drive/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, targetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to move.");
      setMoving(null);
      current ? await loadFolder(current) : await loadRoot();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to move.");
    } finally {
      setBusy(""); setMenuId(null);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    for (const file of Array.from(files)) {
      setUpload({ name: file.name, percent: 0 });
      try {
        const contentType = file.type || "application/octet-stream";
        const res = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "google-drive", fileName: file.name, fileSize: file.size, contentType, parentId: current?.id }),
        });
        const data = await res.json();
        if (!res.ok || !data.upload?.uploadUrl) throw new Error(data.error || "Could not start the upload.");
        for (let start = 0; start < file.size; start += CHUNK_SIZE) {
          const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size), contentType);
          await sendChunk(data.upload.uploadUrl, chunk, start, file.size, loaded => {
            setUpload({ name: file.name, percent: Math.min(99, Math.round(((start + loaded) / file.size) * 100)) });
          });
        }
        setUpload({ name: file.name, percent: 100 });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Upload failed.");
      }
    }
    setUpload(null);
    if (fileInput.current) fileInput.current.value = "";
    current ? await loadFolder(current) : await loadRoot();
  }

  const showRootView = !current;
  const folderCount = folders.length;

  if (checking) {
    return <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <h2>Content vault</h2>
          <p>Checking your Google Drive connection.</p>
        </div>
      </div>
      <div className="dm-loading"><CandleLoader size="md" label="Checking Drive" /></div>
    </section>;
  }

  if (!connected) {
    return <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <h2>Content vault</h2>
          <p>Connect Google Drive once on this Vercel deployment before managing course folders.</p>
        </div>
      </div>
      <div className="admin-empty">
        <strong>Google Drive is not connected</strong>
        <small>Use an administrator account and approve Drive access so Vercel can save a refresh token in Turso.</small>
        <a className="connection-button" href="/api/google-drive/connect?mode=drive" style={{ marginTop: 14 }}>
          <Link2 size={14} /> Connect Drive
        </a>
      </div>
    </section>;
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <h2>Content vault</h2>
          <p>Your Google Drive folder is the source of truth. Create course folders, upload videos, and they auto-sequence in order.</p>
        </div>
        <div className="dm-toolbar">
          <button className="dm-btn" onClick={() => (current ? loadFolder(current) : loadRoot())} disabled={loading}>
            <RefreshCw size={15} className={loading ? "evp-spin" : ""} /> Refresh
          </button>
          {!creatingFolder && (
            <button className="dm-btn" onClick={() => setCreatingFolder(true)}>
              <FolderPlus size={15} /> New folder
            </button>
          )}
          <button className="dm-btn accent" onClick={() => fileInput.current?.click()} disabled={Boolean(upload)}>
            <UploadCloud size={15} /> Upload {current ? "to folder" : "video"}
          </button>
          <input ref={fileInput} type="file" hidden multiple accept="video/*,application/pdf,image/*" onChange={e => handleFiles(e.target.files)} />
        </div>
      </div>

      {/* breadcrumb */}
      <div className="dm-crumbs">
        <button className={showRootView ? "active" : ""} onClick={() => loadFolder(null)}>
          <FolderClosed size={14} /> Content root
        </button>
        {current && (
          <>
            <ChevronRight size={14} className="dm-crumb-sep" />
            <span className="active">{current.name}</span>
          </>
        )}
      </div>

      {creatingFolder && (
        <div className="dm-newfolder">
          <input
            autoFocus
            value={newFolderName}
            placeholder={current ? `New folder inside ${current.name}` : "New course folder name"}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void createFolder(); if (e.key === "Escape") setCreatingFolder(false); }}
          />
          <button className="dm-btn accent" onClick={createFolder} disabled={busy === "folder" || !newFolderName.trim()}>
            {busy === "folder" ? "Creating…" : "Create"}
          </button>
          <button className="dm-btn" onClick={() => { setCreatingFolder(false); setNewFolderName(""); }}>Cancel</button>
        </div>
      )}

      {upload && (
        <div className="dm-upload">
          <div className="dm-upload-head"><Film size={15} /> Uploading <strong>{upload.name}</strong><span>{upload.percent}%</span></div>
          <div className="dm-upload-bar"><div style={{ width: `${upload.percent}%` }} /></div>
        </div>
      )}

      {error && <div className="admin-empty error"><p className="error-text">{error}</p><button className="admin-retry" onClick={() => (current ? loadFolder(current) : loadRoot())}>Try again</button></div>}

      {loading ? (
        <div className="dm-loading"><CandleLoader size="md" label="Reading Drive" /></div>
      ) : showRootView ? (
        // ROOT: show course folders as cards
        <div className="dm-grid">
          {folderCount === 0 && !error && (
            <div className="admin-empty" style={{ gridColumn: "1 / -1" }}>
              <strong>No course folders yet</strong>
              <small>Create your first folder — each folder becomes a course, and the videos inside play in sequence.</small>
            </div>
          )}
          {folders.map(folder => (
            <div key={folder.id} className="dm-folder-card">
              <button className="dm-folder-open" onClick={() => loadFolder(folder)}>
                <span className="dm-folder-icon"><FolderClosed size={22} /></span>
                <span className="dm-folder-name">{folder.name}</span>
              </button>
              <div className="dm-menu-wrap">
                <button className="dm-menu-btn" onClick={() => setMenuId(menuId === folder.id ? null : folder.id)} aria-label="Folder actions"><MoreVertical size={16} /></button>
                {menuId === folder.id && (
                  <div className="dm-menu">
                    <button onClick={() => rename(folder)}><Pencil size={14} /> Rename</button>
                    <button className="danger" onClick={() => remove(folder)}><Trash2 size={14} /> Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Loose files sitting at the content root — not inside any course. */}
      {showRootView && !loading && rootFiles.length > 0 && (
        <div className="dm-loose">
          <div className="dm-loose-head">
            <span><FileVideo size={15} /> Not in a course yet</span>
            <small>These files sit in the content root. Move each into a course folder so members can see it.</small>
          </div>
          <div className="dm-list">
            {rootFiles.map(entry => (
              <div key={entry.id} className="dm-row">
                <span className="dm-seq">—</span>
                <span className="dm-thumb">
                  {entry.thumbnailLink ? <Image src={entry.thumbnailLink} alt="" width={80} height={45} unoptimized referrerPolicy="no-referrer" /> : isVideo(entry) ? <FileVideo size={18} /> : <Film size={18} />}
                </span>
                <div className="dm-row-main">
                  <strong>{entry.name}</strong>
                  <small>
                    {isVideo(entry) && <span className="dm-tag">VIDEO</span>}
                    {bytes(entry.size) && <span>{bytes(entry.size)}</span>}
                  </small>
                </div>
                <div className="dm-row-actions">
                  {isVideo(entry) && <button className="dm-play" onClick={() => setPreview(entry)} aria-label="Preview"><PlayCircle size={18} /> Play</button>}
                  <button className="dm-btn accent" disabled={busy === entry.id} onClick={() => setMoving(entry)}><FolderInput size={14} /> Move to course</button>
                  <div className="dm-menu-wrap">
                    <button className="dm-menu-btn" onClick={() => setMenuId(menuId === entry.id ? null : entry.id)} aria-label="Actions"><MoreVertical size={16} /></button>
                    {menuId === entry.id && (
                      <div className="dm-menu">
                        <button onClick={() => rename(entry)}><Pencil size={14} /> Rename</button>
                        <button className="danger" onClick={() => remove(entry)}><Trash2 size={14} /> Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!showRootView && (
        // INSIDE A FOLDER: sequenced video/file list
        <div className="dm-list">
          {entries.length === 0 && (
            <div className="admin-empty">
              <strong>This folder is empty</strong>
              <small>Upload videos here — they’ll be numbered 01, 02, 03… automatically.</small>
              <button className="dm-btn accent" style={{ marginTop: 12 }} onClick={() => fileInput.current?.click()}><Plus size={15} /> Upload video</button>
            </div>
          )}
          {entries.map((entry, index) => (
            <div key={entry.id} className="dm-row">
              <span className="dm-seq">{isVideo(entry) ? String(index + 1).padStart(2, "0") : "—"}</span>
              <span className="dm-thumb">
                {entry.thumbnailLink
                  ? <Image src={entry.thumbnailLink} alt="" width={80} height={45} unoptimized referrerPolicy="no-referrer" />
                  : isVideo(entry) ? <FileVideo size={18} /> : isFolder(entry) ? <FolderClosed size={18} /> : <Film size={18} />}
              </span>
              <div className="dm-row-main">
                <strong>{entry.name}</strong>
                <small>
                  {isVideo(entry) && <span className="dm-tag">VIDEO</span>}
                  {duration(entry.videoMediaMetadata?.durationMillis) && <span>{duration(entry.videoMediaMetadata?.durationMillis)}</span>}
                  {bytes(entry.size) && <span>{bytes(entry.size)}</span>}
                </small>
              </div>
              <div className="dm-row-actions">
                {isVideo(entry) && (
                  <button className="dm-play" onClick={() => setPreview(entry)} aria-label="Preview"><PlayCircle size={18} /> Play</button>
                )}
                <div className="dm-menu-wrap">
                  <button className="dm-menu-btn" onClick={() => setMenuId(menuId === entry.id ? null : entry.id)} aria-label="Actions"><MoreVertical size={16} /></button>
                  {menuId === entry.id && (
                    <div className="dm-menu">
                      <button onClick={() => rename(entry)}><Pencil size={14} /> Rename</button>
                      <button onClick={() => { setMenuId(null); setMoving(entry); }}><FolderInput size={14} /> Move to…</button>
                      <button className="danger" onClick={() => remove(entry)}><Trash2 size={14} /> Delete</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* video preview modal */}
      {preview && (
        <div className="dm-preview" onClick={() => setPreview(null)}>
          <div className="dm-preview-inner" onClick={e => e.stopPropagation()}>
            <div className="dm-preview-head">
              <span>{preview.name}</span>
              <button className="dm-preview-close" onClick={() => setPreview(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <SecureVideoPlayer videoUrl={`/api/drive/stream/${preview.id}`} title={preview.name} poster={preview.thumbnailLink} />
          </div>
        </div>
      )}

      {/* move-to-course picker */}
      {moving && (
        <div className="dm-preview" onClick={() => setMoving(null)}>
          <div className="dm-move" onClick={e => e.stopPropagation()}>
            <div className="dm-preview-head">
              <span>Move “{moving.name}” into a course</span>
              <button className="dm-preview-close" onClick={() => setMoving(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="dm-move-body">
              {folders.length === 0 ? (
                <div className="admin-empty">
                  <strong>No course folders yet</strong>
                  <small>Create a folder first, then move this file into it.</small>
                </div>
              ) : (
                <div className="dm-move-list">
                  {folders
                    .filter(folder => folder.id !== current?.id)
                    .map(folder => (
                      <button key={folder.id} className="dm-move-target" disabled={busy === moving.id} onClick={() => moveTo(moving, folder.id)}>
                        <span className="dm-folder-icon"><FolderClosed size={18} /></span>
                        <span>{folder.name}</span>
                        <FolderInput size={15} className="dm-move-go" />
                      </button>
                    ))}
                </div>
              )}
              {current && (
                <button className="dm-move-root" disabled={busy === moving.id} onClick={() => moveTo(moving, undefined)}>
                  <ArrowLeft size={14} /> Move back to content root
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
