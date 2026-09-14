"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const safe = (error?.message ?? "Unexpected error").replace(/<[^>]*>/g, "").slice(0, 300);

  return (
    <html lang="en">
      <body className="bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm" role="alert">
            <p className="text-xs font-semibold uppercase tracking-widest text-red-600">Error</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900">Something went wrong</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{safe}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={reset} className={cn(buttonVariants({ size: "sm" }))}>
                Try again
              </button>
              <Link href="/analysis" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Go to Analysis
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
