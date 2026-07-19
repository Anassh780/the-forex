import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { PageTransition } from "@/components/ui";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "EdgeLedger — Trade Smarter. Grow Faster.",
  description: "Verified trading strategies, practical education, and powerful market tools for modern traders.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" data-theme="midnight" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('edgeledger-theme');t=t==='ivory'?'ivory':'midnight';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t==='ivory'?'light':'dark'}catch(e){}})()` }} /></head>
      <body>
        <Providers>
          <Nav />
          <PageTransition>{children}</PageTransition>
        </Providers>
      </body>
    </html>
  );
}
