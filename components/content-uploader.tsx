"use client";

import { CheckCircle2, Cloud, FileUp, HardDrive, Link2, LoaderCircle, PlugZap, Unplug, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Provider = "firebase" | "google-drive";
type UploadState = "idle" | "uploading" | "success" | "error";
type ProviderStatus = {
  configured?: boolean;
  connected?: boolean;
  missing?: string[];
  bucket?: string | null;
  folderId?: string | null;
  folder?: string;
  maxUploadMb?: number;
  accountEmail?: string | null;
  accountName?: string | null;
  error?: string;
  files?: Array<{
    id: string;
    name: string;
    mimeType?: string;
    size?: string;
    modifiedTime?: string;
    webViewLink?: string;
  }>;
};
type StorageStatus = { firebase?: ProviderStatus; drive?: ProviderStatus; error?: string };

const CHUNK_SIZE = 10 * 1024 * 1024;

function bytes(value?: number | string) {
  let amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "--";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit++; }
  return `${amount >= 100 || unit === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`;
}

function dateLabel(value?: string) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function putFile(uploadUrl: string, file: File, contentType: string, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Storage rejected this upload (${request.status}).`));
    request.onerror = () => reject(new Error("The connection was interrupted while sending this file."));
    request.send(file);
  });
}

const MAX_GOOGLE_CHUNK_RETRIES = 2;

async function sendGoogleChunk(uploadUrl: string, chunk: Blob, start: number, total: number, onProgress: (loaded: number) => void) {
  const contentType = chunk.type || "application/octet-stream";
  const response = await fetch("/api/uploads/chunk", {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Range": `bytes ${start}-${start + chunk.size - 1}/${total}`,
      "Content-Length": String(chunk.size),
      "x-upload-url": uploadUrl,
    },
    body: chunk,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Upload failed." })) as { error?: string };
    throw new Error(err.error || `Google Drive rejected this upload (${response.status})`);
  }
  onProgress(chunk.size);
}

async function putGoogleChunk(uploadUrl: string, chunk: Blob, start: number, total: number, onProgress: (loaded: number) => void) {
  let attempt = 0;
  while (true) {
    try {
      await sendGoogleChunk(uploadUrl, chunk, start, total, onProgress);
      return;
    } catch (error) {
      attempt += 1;
      if (attempt > MAX_GOOGLE_CHUNK_RETRIES) throw error;
      await new Promise(resolve => setTimeout(resolve, 650));
    }
  }
}

export function ContentUploader() {
  const input = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState<Provider>("google-drive");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [checking, setChecking] = useState(true);

  const refreshStorage = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/storage/status", { cache: "no-store" });
      const result = await response.json();
      setStorage(response.ok ? result : { error: result.error || "Unable to check storage." });
    } catch {
      setStorage({ error: "Unable to check storage." });
    } finally { setChecking(false); }
  }, []);

  useEffect(() => { void refreshStorage(); }, [refreshStorage]);

  const active = provider === "firebase" ? storage?.firebase : storage?.drive;
  const connected = Boolean(active?.connected);
  const label = provider === "firebase" ? "Firebase Storage" : "Google Drive";

  function choose(next: File | null) {
    setFile(next);
    setState("idle");
    setMessage("");
    setProgress(0);
  }

  async function disconnectDrive() {
    if (!window.confirm("Disconnect this Google Drive account from EdgeLedger? Stored files will remain in Drive.")) return;
    await fetch("/api/google-drive/status", { method: "DELETE" });
    await refreshStorage();
  }

  async function upload() {
    if (!file || state === "uploading" || !connected) return;
    setState("uploading");
    setProgress(0);
    const contentType = file.type || "application/octet-stream";
    setMessage(`Creating a secure ${label} upload link...`);
    try {
      const response = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, fileName: file.name, fileSize: file.size, contentType }),
      });
      const result = await response.json() as { error?: string; upload?: { provider?: Provider; uploadUrl?: string; fileName?: string; folder?: string; contentType?: string } };
      if (!response.ok || !result.upload?.uploadUrl) throw new Error(result.error || `${label} did not create an upload link.`);

      setMessage(`Uploading directly to ${label}...`);
      if (provider === "google-drive") {
        for (let start = 0; start < file.size; start += CHUNK_SIZE) {
          const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size), contentType);
          await putGoogleChunk(result.upload.uploadUrl, chunk, start, file.size, loaded => {
            setProgress(Math.min(99, Math.round(((start + loaded) / file.size) * 100)));
          });
        }
      } else {
        await putFile(result.upload.uploadUrl, file, result.upload.contentType || contentType, setProgress);
      }
      setProgress(100);
      setState("success");
      setMessage(`Stored in ${result.upload.folder || active?.folder || label}/${result.upload.fileName || file.name}`);
      await refreshStorage();
    } catch (reason) {
      setState("error");
      setMessage(reason instanceof Error ? reason.message : "The upload could not be completed.");
    }
  }

  const capacity = provider === "firebase" ? active?.bucket || "Firebase bucket" : active?.accountEmail || "Google Drive";
  const available = active?.connected ? "secure connection ready" : `Missing ${active?.missing?.join(", ") || `${label} setup`}`;
  const maxUpload = active?.maxUploadMb ? bytes(active.maxUploadMb * 1024 * 1024) : "provider limit";
  const driveFiles = storage?.drive?.files || [];

  return <section className="storage-console">
    <div className="storage-head">
      <div><span><Cloud size={15} /> CONTENT STORAGE</span><h3>Firebase and Drive vault</h3><p>Choose Firebase Storage or Google Drive for course videos, reports, datasets, and member resources.</p></div>
      <div className="storage-capacity"><HardDrive size={20} /><strong>{capacity}</strong><span>{available}</span></div>
    </div>

    <div className="storage-switch">
      {(["google-drive", "firebase"] as Provider[]).map(item => {
        const itemStatus = item === "firebase" ? storage?.firebase : storage?.drive;
        return <button key={item} type="button" className={provider === item ? "active" : ""} onClick={() => { setProvider(item); choose(null); }}>
          {item === "firebase" ? "Firebase" : "Google Drive"} <span>{itemStatus?.connected ? "Ready" : itemStatus?.configured ? "Connect" : "Setup"}</span>
        </button>;
      })}
    </div>

    <div className={`storage-connection ${connected ? "connected" : ""}`}>
      <span className="connection-icon">{checking ? <LoaderCircle className="spin" size={20} /> : connected ? <CheckCircle2 size={20} /> : <PlugZap size={20} />}</span>
      <div>
        <strong>{checking ? `Checking ${label}` : connected ? `${label} connected` : `${label} setup required`}</strong>
        <small>{checking ? "Confirming the private server connection..." : connected ? provider === "firebase" ? `${active?.bucket} / ${active?.folder}` : `${active?.accountName || active?.accountEmail || "Google account"} / ${active?.folder}` : provider === "firebase" ? "Add the Firebase service account and bucket, then restart the website." : "Authorize Google Drive with your Google account."}</small>
        {(active?.error || storage?.error) && <em>{active?.error || storage?.error}</em>}
      </div>
      {!checking && provider === "google-drive" && (connected
        ? <button type="button" className="connection-button subtle" onClick={disconnectDrive}><Unplug size={14} /> DISCONNECT</button>
        : active?.configured
          ? <a className="connection-button" href="/api/google-drive/connect?mode=drive"><Link2 size={14} /> CONNECT DRIVE</a>
          : <span className="connection-pending">CONFIG REQUIRED</span>)}
      {!checking && provider === "firebase" && <span className={connected ? "connection-pending connected" : "connection-pending"}>{connected ? "READY" : "CONFIG REQUIRED"}</span>}
    </div>

    <button type="button" className={`upload-dropzone ${file ? "has-file" : ""}`} disabled={!connected} onClick={() => input.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (connected) choose(event.dataTransfer.files[0] || null); }}>
      <input ref={input} type="file" hidden onChange={event => choose(event.target.files?.[0] || null)} />
      <span className="upload-icon"><FileUp size={27} /></span>
      {file ? <><strong>{file.name}</strong><small>{bytes(file.size)} - Click to replace</small></> : <><strong>{connected ? "Drop content here or browse" : `Connect ${label} to enable uploads`}</strong><small>{provider === "google-drive" ? "Resumable 10 MB chunks" : `Direct signed upload - Max ${maxUpload}`}</small></>}
    </button>
    {state !== "idle" && <div className={`upload-status ${state}`}><div><span>{state === "uploading" ? <LoaderCircle className="spin" size={15} /> : state === "success" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}{message}</span><b>{progress}%</b></div><i><em style={{ width: `${progress}%` }} /></i></div>}
    {provider === "google-drive" && connected && <div className="drive-browser">
      <div className="drive-browser-head">
        <div><span>CONNECTED FOLDER</span><strong>{active?.folder || "EdgeLedger Content"}</strong><small>{active?.accountName || active?.accountEmail || "Google Drive"} {active?.folderId ? `- ${active.folderId}` : ""}</small></div>
        <button type="button" onClick={refreshStorage}>REFRESH</button>
      </div>
      <div className="drive-file-list">
        {driveFiles.length ? driveFiles.map(item => <a key={item.id} href={item.webViewLink || "#"} target="_blank" rel="noreferrer" className="drive-file-row">
          <span><FileUp size={15} /></span>
          <strong>{item.name}</strong>
          <small>{bytes(item.size)} - {dateLabel(item.modifiedTime)}</small>
        </a>) : <div className="drive-empty">
          <strong>No uploaded files yet</strong>
          <small>Upload content to Drive and it will appear here automatically.</small>
        </div>}
      </div>
    </div>}
    <div className="storage-actions"><p>Only administrators can create upload links. Secrets stay on the server and files are sent directly to the selected storage provider.</p><button type="button" onClick={upload} disabled={!file || state === "uploading" || !connected}>{state === "uploading" ? "UPLOADING..." : `UPLOAD TO ${provider === "firebase" ? "FIREBASE" : "DRIVE"}`}</button></div>
  </section>;
}
