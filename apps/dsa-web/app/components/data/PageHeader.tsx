import type { ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

// Source: shadcn/ui layout convention (eyebrow + H1 + description + actions), Tailwind v3 hand-built
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function HeaderActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
      {children}
    </Link>
  );
}
