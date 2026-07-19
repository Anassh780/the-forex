"use client";

import { useEffect } from "react";

export default function Error({
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
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="rounded-xl border border-loss/20 bg-loss/5 p-8">
        <svg
          className="mx-auto mb-4 h-12 w-12 text-loss"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>
        <h2 className="font-display text-2xl text-paper">Something went wrong</h2>
        <p className="mt-2 max-w-md text-sm text-muted">
          An unexpected error occurred. You can try again or head back to the dashboard.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-brass px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-lg border border-muted/30 px-5 py-2.5 text-sm font-semibold text-paper transition hover:border-muted/60"
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
