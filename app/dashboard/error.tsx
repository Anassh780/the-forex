"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-shell py-20">
      <div className="mx-auto max-w-xl border hairline bg-panel p-8 text-center">
        <div className="eyebrow text-loss">Dashboard recovery</div>
        <h1 className="mt-4 font-display text-3xl font-semibold">Your desk could not open</h1>
        <p className="mt-3 text-sm text-muted">
          Retry the dashboard without losing your session. If the app was just updated, reload it once to fetch the latest files.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button className="rounded-sm bg-brass px-5 py-3 text-xs font-bold tracking-wider text-ink" onClick={reset}>
            RETRY DASHBOARD
          </button>
          <button className="rounded-sm border border-white/15 px-5 py-3 text-xs font-bold tracking-wider text-paper" onClick={() => window.location.reload()}>
            RELOAD APP
          </button>
          <Link className="rounded-sm border border-white/15 px-5 py-3 text-xs font-bold tracking-wider text-paper" href="/">
            GO HOME
          </Link>
        </div>
      </div>
    </div>
  );
}
