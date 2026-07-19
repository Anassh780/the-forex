"use client";

import { Moon, SunMedium } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type SiteTheme = "midnight" | "ivory";

const ThemeContext = createContext<{ theme: SiteTheme; setTheme: (theme: SiteTheme) => void }>({ theme: "midnight", setTheme: () => undefined });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<SiteTheme>("midnight");

  useEffect(() => {
    const saved = document.documentElement.dataset.theme === "ivory" ? "ivory" : "midnight";
    setThemeState(saved);
  }, []);

  function setTheme(next: SiteTheme) {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === "ivory" ? "light" : "dark";
    localStorage.setItem("edgeledger-theme", next);
  }

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useContext(ThemeContext);
  return <div className={`theme-choice ${compact ? "compact" : ""}`} role="group" aria-label="Website color theme">
    <button type="button" aria-label="Use black theme" title="Black theme" aria-pressed={theme === "midnight"} className={theme === "midnight" ? "active" : ""} onClick={() => setTheme("midnight")}><Moon size={13} />{!compact && "Black"}</button>
    <button type="button" aria-label="Use ivory theme" title="Ivory theme" aria-pressed={theme === "ivory"} className={theme === "ivory" ? "active" : ""} onClick={() => setTheme("ivory")}><SunMedium size={13} />{!compact && "Ivory"}</button>
  </div>;
}
