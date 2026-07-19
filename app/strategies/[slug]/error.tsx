"use client";

import Link from "next/link";

export default function StrategyError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="container-shell flex min-h-[60vh] flex-col items-center justify-center gap-6 py-20 text-center">
      <span className="font-mono text-5xl font-bold text-loss">!</span>
      <h2 className="font-display text-2xl text-paper">Strategy unavailable</h2>
      <p className="max-w-md text-sm text-muted">
        We couldn&apos;t load this strategy. It may have been removed or there was a connection issue.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-brass px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
        >
          Try again
        </button>
        <Link
          href="/strategies"
          className="rounded-lg border border-muted/30 px-5 py-2.5 text-sm font-semibold text-paper transition hover:border-muted/60"
        >
          All strategies
        </Link>
      </div>
    </main>
  );
}
