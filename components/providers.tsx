"use client";

import { SessionProvider } from "next-auth/react";
import { PremiumInteractions } from "@/components/premium-interactions";
import { ThemeProvider } from "@/components/theme-toggle";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><ThemeProvider><PremiumInteractions />{children}</ThemeProvider></SessionProvider>;
}
