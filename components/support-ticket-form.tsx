"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Clock3, FilePlus2, LifeBuoy, Send, TicketCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { uniqueBy } from "@/lib/collections";

type Ticket = { id: string; subject: string; category: string; priority: string; status: string; createdAt: string };

export function SupportTicketForm() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("account");
  const [priority, setPriority] = useState("normal");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(() => { void fetch("/api/support-tickets", { cache: "no-store" }).then(response => response.ok ? response.json() : []).then(data => setTickets(uniqueBy(Array.isArray(data) ? data : [], ticket => ticket.id).slice(0, 4))).catch(() => undefined); }, []);
  useEffect(load, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(null);
    const form = new FormData(); form.set("subject", subject); form.set("message", message); form.set("category", category); form.set("priority", priority); files.forEach(file => form.append("attachments", file));
    try {
      const response = await fetch("/api/support-tickets", { method: "POST", body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to open ticket.");
      setSubject(""); setMessage(""); setFiles([]); setPriority("normal"); setNotice({ type: "ok", text: `Ticket ${data.id.slice(-6).toUpperCase()} opened successfully.` }); load();
    } catch (reason) { setNotice({ type: "error", text: reason instanceof Error ? reason.message : "Unable to open ticket." }); } finally { setBusy(false); }
  }

  return <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="ticket-widget">
    <div className="ticket-widget-head"><span><LifeBuoy size={19} /></span><div><small>DEDICATED SUPPORT</small><h2>Open a support ticket</h2><p>Get a trackable case number and follow its status here.</p></div></div>
    <form onSubmit={submit}>
      <div className="ticket-fields"><label><span>Category</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="account">Account</option><option value="billing">Plans & billing</option><option value="course">Course playback</option><option value="strategy">Strategies</option><option value="security">Security</option><option value="technical">Technical issue</option></select></label><label><span>Priority</span><select value={priority} onChange={event => setPriority(event.target.value)}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label></div>
      <label><span>Subject</span><input value={subject} onChange={event => setSubject(event.target.value)} placeholder="What do you need help with?" /></label>
      <label><span>Details</span><textarea value={message} onChange={event => setMessage(event.target.value)} placeholder="Include what happened, what you expected, and any error message…" rows={5} /></label>
      <input ref={input} hidden type="file" multiple onChange={event => setFiles(current => uniqueBy([...current, ...Array.from(event.target.files || [])], file => `${file.name}:${file.size}:${file.lastModified}`).slice(0, 5))} />
      <button type="button" className="ticket-attach" onClick={() => input.current?.click()}><FilePlus2 size={15} /> Attach screenshot, audio, video, PDF or document</button>
      <AnimatePresence>{files.length > 0 && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ticket-files">{files.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={() => setFiles(files.filter((_, i) => i !== index))}><X size={12} /></button></span>)}</motion.div>}</AnimatePresence>
      {notice && <p className={`ticket-notice ${notice.type}`}>{notice.type === "ok" && <CheckCircle2 size={14} />}{notice.text}</p>}
      <button className="ticket-submit" disabled={busy}>{busy ? <span className="admin-spinner" /> : <><Send size={15} /> Open ticket</>}</button>
    </form>
    {tickets.length > 0 && <div className="ticket-recent"><div><TicketCheck size={15} /><strong>Your recent tickets</strong></div>{tickets.map(ticket => <article key={ticket.id}><span><Clock3 size={12} /> {new Date(ticket.createdAt).toLocaleDateString()}</span><strong>{ticket.subject}</strong><i data-status={ticket.status}>{ticket.status.replace("_", " ")}</i></article>)}</div>}
  </motion.section>;
}
