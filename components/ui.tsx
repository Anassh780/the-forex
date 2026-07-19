"use client";

import { AnimatePresence, motion, useInView, useMotionValue, useReducedMotion, useSpring, type HTMLMotionProps } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  // A single permanent page root prevents route-transition remnants from being
  // retained below the current route and creating a bottom-to-top scroll loop.
  return <main data-app-page>{children}</main>;
}

export function Button({ children, variant = "primary", className = "", ...props }: HTMLMotionProps<"button"> & { variant?: "primary" | "outline" | "ghost" }) {
  const styles = variant === "primary" ? "bg-brass text-ink border-brass" : variant === "outline" ? "bg-transparent border-white/15 text-paper" : "bg-transparent border-transparent text-muted";
  const reduceMotion = useReducedMotion();
  return <motion.button whileTap={reduceMotion ? undefined : { scale: .985 }} whileHover={reduceMotion ? undefined : { y: -1 }} transition={{ duration: .12, ease: "easeOut" }} className={`relative rounded-sm border px-5 py-3 text-[12px] font-bold tracking-[.08em] disabled:opacity-50 ${styles} ${className}`} {...props}>{children}</motion.button>;
}

export function Input({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const [focus, setFocus] = useState(false);
  const reduceMotion = useReducedMotion();
  return <motion.label animate={!reduceMotion && error ? { x: [0,-4,4,-2,2,0] } : {}} transition={{ duration: .24 }} className="relative block pt-3">
    <motion.span animate={{ y: focus || props.value ? -12 : 11, scale: focus || props.value ? .78 : 1, color: focus ? "#C9A227" : "#8A8F98" }} transition={{ duration: reduceMotion ? 0 : .16, ease: "easeOut" }} className="pointer-events-none absolute left-4 top-4 origin-left text-sm">{label}</motion.span>
    <input {...props} onFocus={e => { setFocus(true); props.onFocus?.(e); }} onBlur={e => { setFocus(false); props.onBlur?.(e); }} className="w-full rounded-sm border border-white/10 bg-panel px-4 pb-3 pt-6 text-sm outline-none transition duration-200 focus:border-brass/60 focus:shadow-[0_0_0_3px_rgba(201,162,39,.08)]" />
    {error && <span className="mt-1 block text-xs text-loss">{error}</span>}
  </motion.label>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return <motion.article whileHover={reduceMotion ? undefined : { y: -4 }} transition={{ duration: .18, ease: "easeOut" }} className={`border hairline bg-panel ${className}`}>{children}</motion.article>;
}

export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null); const seen = useInView(ref, { once: true, margin: "-60px" });
  const reduceMotion = useReducedMotion();
  return <motion.div ref={ref} initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={seen || reduceMotion ? { opacity: 1, y: 0 } : {}} transition={{ duration: reduceMotion ? 0 : .28, delay: reduceMotion ? 0 : Math.min(delay, .08), ease: [0.25,0.8,0.35,1] }} className={className}>{children}</motion.div>;
}

export function StatCounter({ value, suffix = "", label, decimals = 0 }: { value: number; suffix?: string; label: string; decimals?: number }) {
  const ref = useRef(null); const seen = useInView(ref, { once: true }); const raw = useMotionValue(0); const spring = useSpring(raw, { damping: 28, stiffness: 80 }); const [display, setDisplay] = useState("0");
  useEffect(() => { if (seen) raw.set(value); return spring.on("change", v => setDisplay(v.toFixed(decimals))); }, [seen, value, raw, spring, decimals]);
  return <div ref={ref} className="border-l border-white/10 pl-4"><div className="font-mono text-2xl font-medium text-paper">{display}<span className="text-profit">{suffix}</span></div><div className="mt-1 text-[10px] uppercase tracking-[.15em] text-muted">{label}</div></div>;
}

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .16 }} className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-5" onClick={onClose}><motion.div initial={{ opacity: 0, scale: .98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .99 }} transition={{ duration: .2, ease: [0.22,1,0.36,1] }} className="glass relative max-h-[90vh] w-full max-w-3xl overflow-auto border border-brass/20 p-6" onClick={e => e.stopPropagation()}><button onClick={onClose} className="absolute right-4 top-4 text-muted hover:text-paper"><X size={20}/></button>{children}</motion.div></motion.div>}</AnimatePresence>;
}

export function Skeleton({ className = "" }: { className?: string }) { return <div className={`bg-gradient-to-r from-white/[.03] via-white/[.08] to-white/[.03] ${className}`} />; }
