import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <span className="font-mono text-6xl font-bold text-brass">404</span>
        <h1 className="mt-3 font-display text-2xl text-paper">Page not found</h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-brass px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
        >
          Back to EdgeLedger
        </Link>
      </div>
    </main>
  );
}
