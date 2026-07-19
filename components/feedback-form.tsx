"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, File, Image, Loader2, MessageSquareText, Mic, Paperclip, Send, Star, Video, X } from "lucide-react";
import { uniqueBy } from "@/lib/collections";

type Attachment = { name: string; url: string; type: string; size: number };
type FeedbackItem = { id: string; category: string; rating: number; message: string; attachments: Attachment[]; createdAt: string };

const categories = [
  ["product", "Product experience"],
  ["course", "Courses"],
  ["strategy", "Strategies"],
  ["support", "Support"],
  ["bug", "Report a problem"],
  ["other", "Other"],
] as const;

function attachmentIcon(type: string) {
  if (type.startsWith("image/")) return Image;
  if (type.startsWith("audio/")) return Mic;
  if (type.startsWith("video/")) return Video;
  return File;
}

function readableSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function FeedbackForm({ defaultCategory = "product", title = "Tell us what you think", subtitle = "Your feedback is saved to your account." }: { defaultCategory?: string; title?: string; subtitle?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(defaultCategory);
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [history, setHistory] = useState<FeedbackItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/feedback", { cache: "no-store" })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load feedback.");
        setHistory(uniqueBy(Array.isArray(body) ? body : [], item => item.id));
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load feedback."))
      .finally(() => setLoadingHistory(false));
  }, []);

  function addFiles(selected: FileList | null) {
    if (!selected) return;
    setSuccess(false);
    setError("");
    setFiles(current => uniqueBy([...current, ...Array.from(selected)], file => `${file.name}:${file.size}:${file.lastModified}`).slice(0, 5));
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(false);
    try {
      const body = new FormData();
      body.set("category", category);
      body.set("rating", String(rating));
      body.set("message", message);
      files.forEach(file => body.append("attachments", file));
      const response = await fetch("/api/feedback", { method: "POST", body });
      const result = await response.json().catch(() => ({})) as { error?: string; feedback?: FeedbackItem };
      if (!response.ok || !result.feedback) throw new Error(result.error || "Unable to send feedback.");
      setHistory(current => uniqueBy([result.feedback!, ...current], item => item.id));
      setMessage("");
      setFiles([]);
      setRating(5);
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <form onSubmit={submit} className="border hairline bg-panel p-6 md:p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-brass/10 text-brass"><MessageSquareText size={19} /></span>
          <div>
            <h2 className="font-display text-2xl">{title}</h2>
            <p className="mt-1 text-xs text-muted">{subtitle}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-bold tracking-wider text-muted">TOPIC</span>
            <select aria-label="Feedback topic" value={category} onChange={event => setCategory(event.target.value)} className="mt-2 w-full rounded-sm border border-white/10 bg-ink px-3 py-3 text-sm outline-none focus:border-brass/50">
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <fieldset>
            <legend className="text-[10px] font-bold tracking-wider text-muted">RATING</legend>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 5].map(value => (
                <button key={value} type="button" aria-label={`${value} star${value === 1 ? "" : "s"}`} onClick={() => setRating(value)} className={value <= rating ? "text-brass" : "text-white/15"}>
                  <Star size={23} fill="currentColor" />
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <label className="mt-6 block">
          <span className="text-[10px] font-bold tracking-wider text-muted">YOUR FEEDBACK</span>
          <textarea aria-label="Your feedback" value={message} onChange={event => setMessage(event.target.value)} maxLength={4000} rows={8} placeholder="Share an idea, describe a problem, or tell us what is working well..." className="mt-2 w-full resize-y rounded-sm border border-white/10 bg-ink px-4 py-3 text-sm leading-6 outline-none placeholder:text-muted/50 focus:border-brass/50" />
          <span className="mt-1 block text-right font-mono text-[9px] text-muted">{message.length} / 4000</span>
        </label>

        <input ref={inputRef} type="file" multiple className="sr-only" aria-label="Feedback attachments" accept="image/jpeg,image/png,image/gif,image/webp,audio/*,video/*,.pdf,.txt,.csv,.json,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={event => addFiles(event.target.files)} />
        <div className="mt-5 rounded-sm border border-dashed border-white/15 bg-white/[.02] p-5 text-center">
          <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 text-xs font-bold tracking-wider text-brass">
            <Paperclip size={15} /> ADD ATTACHMENTS
          </button>
          <p className="mt-2 text-[10px] leading-5 text-muted">Images, audio, video, PDF, Office, text, CSV, JSON or ZIP. Up to 5 files and 30 MB total.</p>
        </div>

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file, index) => {
              const Icon = attachmentIcon(file.type);
              return (
                <div key={`${file.name}-${index}`} className="flex items-center gap-3 border hairline px-3 py-2 text-xs">
                  <Icon size={15} className="shrink-0 text-brass" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="font-mono text-[9px] text-muted">{readableSize(file.size)}</span>
                  <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button>
                </div>
              );
            })}
          </div>
        )}

        {error && <p role="alert" className="mt-5 text-sm text-loss">{error}</p>}
        {success && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-profit"><CheckCircle2 size={16} /> Thank you. Your feedback was sent.</p>}
        <button disabled={submitting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-brass px-5 py-3.5 text-xs font-bold tracking-wider text-ink disabled:opacity-50">
          {submitting ? <Loader2 size={16} className="opacity-60" /> : <Send size={16} />} SEND FEEDBACK
        </button>
      </form>

      <aside className="border hairline bg-panel p-6 md:p-7">
        <div className="eyebrow">Your history</div>
        <h2 className="mt-3 font-display text-2xl">Previous feedback</h2>
        {loadingHistory ? (
          <div className="mt-8 flex items-center gap-2 text-xs text-muted"><Loader2 size={14} className="opacity-60" /> Loading</div>
        ) : history.length === 0 ? (
          <p className="mt-6 text-sm leading-6 text-muted">Your submitted feedback will appear here.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {history.map(item => (
              <article key={item.id} className="border hairline p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-brass">{item.category}</span>
                  <span className="font-mono text-[9px] text-muted">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 flex gap-1 text-brass">{Array.from({ length: item.rating }, (_, index) => <Star key={index} size={10} fill="currentColor" />)}</div>
                {item.message && <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-muted">{item.message}</p>}
                {item.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.attachments.map((attachment, index) => <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noreferrer" className="max-w-full truncate rounded-full border border-white/10 px-2.5 py-1 text-[9px] text-paper hover:border-brass/40">{attachment.name}</a>)}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
