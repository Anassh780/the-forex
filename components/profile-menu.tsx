"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, CircleHelp, Gauge, LogOut, MessageSquareText, Settings, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export function ProfileMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const name = session?.user?.name || session?.user?.email?.split("@")[0] || "Trader";
  const image = session?.user?.image;
  const initial = name.trim()[0]?.toUpperCase() || "U";

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  return (
    <div className="profile-menu" ref={rootRef}>
      <button className="profile-menu-trigger" aria-label="Open profile menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <span className="profile-menu-avatar">
          {image ? <Image src={image} alt="" fill unoptimized sizes="36px" className="object-cover" /> : initial}
        </span>
        <span className="profile-menu-copy">
          <strong>{name}</strong>
          <small>{session?.user?.role || "member"}</small>
        </span>
        <ChevronDown size={14} className={open ? "rotate-180 transition" : "transition"} />
      </button>

      {open && (
        <div className="profile-menu-popover" role="menu">
          <div className="profile-menu-head">
            <span className="profile-menu-avatar profile-menu-avatar-lg">
              {image ? <Image src={image} alt="" fill unoptimized sizes="46px" className="object-cover" /> : initial}
            </span>
            <div className="min-w-0">
              <strong className="block truncate text-sm">{name}</strong>
              <span className="block truncate text-[10px] text-muted">{session?.user?.email}</span>
            </div>
          </div>
          <div className="profile-menu-links">
            <Link href="/dashboard" role="menuitem" onClick={() => setOpen(false)}><Gauge size={15} /> Dashboard</Link>
            <Link href="/profile" role="menuitem" onClick={() => setOpen(false)}><UserRound size={15} /> Profile settings</Link>
            <Link href="/feedback" role="menuitem" onClick={() => setOpen(false)}><MessageSquareText size={15} /> Give feedback</Link>
            <Link href="/support" role="menuitem" onClick={() => setOpen(false)}><CircleHelp size={15} /> Help &amp; support</Link>
            <Link href="/vip" role="menuitem" onClick={() => setOpen(false)}><Settings size={15} /> Manage plan</Link>
          </div>
          <div className="profile-menu-theme"><span>Color theme</span><ThemeToggle /></div>
          <button className="profile-menu-signout" role="menuitem" onClick={() => signOut({ callbackUrl: "/" })}><LogOut size={15} /> Sign out</button>
        </div>
      )}
    </div>
  );
}
