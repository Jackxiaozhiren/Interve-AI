"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, Menu, X } from "lucide-react";
import { checkApiHealth } from "@/lib/api";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/app/components/ui/button";

// Source: https://github.com/TailAdmin/free-nextjs-admin-dashboard (topbar structure) + shadcn Button
const NAV = [
  { href: "/analysis", label: "Analysis" },
  { href: "/evaluations", label: "Evaluation" },
  { href: "/research", label: "Research" },
  { href: "/benchmarks", label: "Benchmarks" },
  { href: "/datasets", label: "Datasets" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [api, setApi] = useState<"up" | "down" | "checking">("checking");

  useEffect(() => {
    let alive = true;
    checkApiHealth()
      .then((s) => alive && setApi(s))
      .catch(() => alive && setApi("down"));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="flex items-center gap-2" aria-label="DSA home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <FlaskConical className="h-4 w-4" aria-hidden />
            </span>
            <span className="truncate text-sm font-semibold tracking-tight text-zinc-900">
              DSA <span className="hidden font-normal text-zinc-500 sm:inline">· Evidence before claim</span>
            </span>
          </Link>
          <span className="hidden items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 md:inline-flex" title={api === "checking" ? "Checking API" : api === "up" ? "API up" : "API down"}>
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                api === "up" ? "bg-emerald-500" : api === "down" ? "bg-red-500" : "bg-amber-400 animate-pulse"
              )}
            />
            API {api === "checking" ? "…" : api}
          </span>
        </div>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={pathname === n.href || pathname?.startsWith(n.href + "/") ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm",
                pathname === n.href || pathname?.startsWith(n.href + "/")
                  ? "bg-zinc-100 font-medium text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              {n.label}
            </Link>
          ))}
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
          >
            GitHub
          </a>
          <Link href="/analysis" className={cn(buttonVariants({ size: "sm" }), "ml-2")}>
            Try DSA
          </Link>
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          <Link href="/analysis" className={cn(buttonVariants({ size: "sm" }))}>
            Try DSA
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700"
          >
            {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-zinc-200 bg-white px-4 py-3 lg:hidden" aria-label="Mobile">
          <div className="mx-auto grid max-w-6xl gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  pathname === n.href ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
                )}
              >
                {n.label}
              </Link>
            ))}
            <a href="https://github.com" target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
              GitHub
            </a>
            <p className="px-3 pt-2 font-mono text-xs text-zinc-500">API status: {api}</p>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
