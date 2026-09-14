"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Source: https://github.com/shadcndashboard/next-shadcn-dashboard (sidebar pattern, zinc minimal)
// Only visible for Analysis / Datasets / Trace-related pages.
const SECTIONS: { match: string[]; links: { href: string; label: string }[] } = {
  match: ["/analysis", "/datasets", "/runs"],
  links: [
    { href: "/datasets", label: "1 · Bring data" },
    { href: "/analysis", label: "2 · Ask question" },
    { href: "/runs", label: "3 · Inspect trace" },
    { href: "/benchmarks", label: "Benchmarks" },
  ],
};

export function SubSidebar() {
  const pathname = usePathname() ?? "/";
  const visible = SECTIONS.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
  if (!visible) return null;
  return (
    <aside className="hidden w-52 shrink-0 lg:block" aria-label="Workflow">
      <nav className="sticky top-20 space-y-1 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
        {SECTIONS.links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm",
                active ? "bg-zinc-900 font-medium text-white" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              {l.label}
            </Link>
          );
        })}
        <p className="px-3 pb-1 pt-2 text-xs leading-5 text-zinc-400">
          Step 1 Bring → Step 2 Ask → Step 3 Inspect.
        </p>
      </nav>
    </aside>
  );
}
