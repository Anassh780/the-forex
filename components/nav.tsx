"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BookOpen, CircleHelp, Menu, MessageSquareText, Users2, Zap, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { ProfileMenu } from "@/components/profile-menu";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  ["/courses", "Products"],
  ["/strategies", "Strategy"],
  ["/dashboard", "Dashboard"],
  ["/vip", "Plans"],
] as const;

const productMainItems = [
  { href: "/courses", label: "Course Library", desc: "Structured video courses", Icon: BookOpen },
  { href: "/feedback", label: "Feedback", desc: "Share ideas in text or media", Icon: MessageSquareText },
  { href: "/support", label: "Help & Support", desc: "Answers and direct assistance", Icon: CircleHelp },
  { href: "/community", label: "Community", desc: "Social channels and broker directory", Icon: Users2 },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated";
  const role = (session?.user as { role?: string } | undefined)?.role;
  const visibleLinks = role === "admin" ? [...links, ["/admin-ui", "Admin"] as const] : links;

  const [productDropdown, setProductDropdown] = useState(false);
  const dropdownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleProductEnter() {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
    setProductDropdown(true);
  }

  function handleProductLeave() {
    dropdownTimeout.current = setTimeout(() => setProductDropdown(false), 200);
  }

  useEffect(() => {
    setOpen(false);
    setProductDropdown(false);
  }, [path]);

  if (path === "/login" || path === "/signup") return null;

  return (
    <header className="site-header">
      <div className="container-shell nav-inner">
        <Link href="/" className="brand" aria-label="EdgeLedger home">
          <span className="brand-mark">
            <Zap size={18} fill="currentColor" />
          </span>
          <span>
            Edge<span>Ledger</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {visibleLinks.map(([href, label]) =>
            label === "Products" ? (
              <div
                key={href}
                className="nav-mega-wrapper"
                onMouseEnter={handleProductEnter}
                onMouseLeave={handleProductLeave}
                onFocusCapture={handleProductEnter}
                onBlurCapture={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) handleProductLeave();
                }}
              >
                <Link
                  href={href}
                  className={path.startsWith(href) ? "active" : ""}
                  aria-haspopup="menu"
                  aria-expanded={productDropdown}
                  onClick={(event) => {
                    event.preventDefault();
                    handleProductEnter();
                  }}
                >
                  {label} <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ marginLeft: "4px", display: "inline-block", verticalAlign: "middle", transition: "transform .2s ease", transform: productDropdown ? "rotate(180deg)" : "rotate(0)" }}><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>
                <AnimatePresence>
                  {productDropdown && (
                    <motion.div
                      className="nav-mega"
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="nav-mega-body">
                        <div className="nav-mega-main">
                          {productMainItems.map(({ href: subHref, label: subLabel, desc, Icon }) => (
                            <Link key={subHref} href={subHref} className="nav-mega-item">
                              <span className="nav-mega-icon">
                                <Icon size={16} />
                              </span>
                              <span className="nav-mega-text">
                                <strong>{subLabel}</strong>
                                <span>{desc}</span>
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link key={href} href={href} className={path.startsWith(href) ? "active" : ""}>
                {label}
              </Link>
            )
          )}
        </nav>
        <div className="nav-actions">
          <ThemeToggle compact />
          {signedIn ? <ProfileMenu /> : (
            <>
              <Link href="/login" className="login-link">
                Log in
              </Link>
              <Link href="/signup" className="nav-cta">
                Get started <ArrowRight size={16} />
              </Link>
            </>
          )}
        </div>
        <button
          className="menu-button"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="mobile-nav"
            aria-label="Mobile navigation"
          >
            <div className="container-shell">
              {visibleLinks.map(([href, label]) => (
                <Link onClick={() => setOpen(false)} href={href} key={href}>
                  {label}
                </Link>
              ))}
              <Link onClick={() => setOpen(false)} href="/feedback">Feedback</Link>
              <Link onClick={() => setOpen(false)} href="/support">Help &amp; Support</Link>
              <Link onClick={() => setOpen(false)} href="/community">Community</Link>
              <ThemeToggle />
              {signedIn && <Link onClick={() => setOpen(false)} href="/profile">Profile settings</Link>}
              <div>
                {signedIn ? (
                  <button onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setOpen(false)}>
                      Log in
                    </Link>
                    <Link href="/signup" onClick={() => setOpen(false)}>
                      Get started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
