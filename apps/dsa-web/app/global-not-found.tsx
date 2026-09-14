import Link from "next/link";

// Global 404 (Next 16 `global-not-found`): rendered without the root layout,
// so it ships its own minimal shell in the same zinc design language.
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="bg-zinc-50 font-sans text-zinc-900 antialiased">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              404 · Not found
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">
              This page does not exist
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              The link may be wrong, or the run/dataset id no longer exists.
              Start from Analysis to produce real evidence.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
              >
                Go home
              </Link>
              <Link
                href="/analysis"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900"
              >
                Go to Analysis
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
