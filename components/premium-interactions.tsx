"use client";

import { useEffect, useRef } from "react";

const revealSelector = [
  "main > section",
  "main > div > section",
  ".dashboard-metric",
  ".plan-card",
  ".community-card",
  ".cl-card",
  ".control-panel",
  ".control-user",
].join(",");

const reactiveSelector = "button,a,.plan-card,.community-card,.dashboard-metric,.control-panel,.control-user,[data-premium-reactive]";

export function PremiumInteractions() {
  const cursor = useRef<HTMLDivElement>(null);
  const meter = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    let frame = 0;

    const updateScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const available = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        meter.current?.style.setProperty("--premium-scroll", String(Math.min(1, Math.max(0, window.scrollY / available))));
      });
    };
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll, { passive: true });

    const move = (event: PointerEvent) => {
      if (finePointer && cursor.current) {
        cursor.current.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
        cursor.current.dataset.visible = "true";
      }
      const reactive = event.target instanceof Element ? event.target.closest(reactiveSelector) as HTMLElement | null : null;
      if (reactive) {
        const bounds = reactive.getBoundingClientRect();
        reactive.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
        reactive.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
      }
    };
    const press = () => cursor.current?.setAttribute("data-pressed", "true");
    const release = () => cursor.current?.removeAttribute("data-pressed");
    const leave = () => cursor.current?.removeAttribute("data-visible");
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", press, { passive: true });
    window.addEventListener("pointerup", release, { passive: true });
    document.documentElement.addEventListener("mouseleave", leave);

    let revealObserver: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    if (!reduced) {
      revealObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.premiumReveal = "seen";
          revealObserver?.unobserve(entry.target);
        }
      }, { threshold: 0.08, rootMargin: "0px 0px -28px" });
      const register = (root: ParentNode) => {
        const matches = root instanceof HTMLElement && root.matches(revealSelector) ? [root] : [];
        const elements = [...matches, ...root.querySelectorAll<HTMLElement>(revealSelector)];
        elements.forEach((element) => {
          if (element.dataset.premiumReveal) return;
          element.dataset.premiumReveal = "pending";
          revealObserver?.observe(element);
        });
      };
      register(document);
      mutationObserver = new MutationObserver((records) => {
        for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement) register(node);
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      document.documentElement.removeEventListener("mouseleave", leave);
      revealObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, []);

  return <><div ref={meter} className="premium-scroll-meter" aria-hidden="true" /><div ref={cursor} className="premium-cursor" aria-hidden="true"><i /></div></>;
}
