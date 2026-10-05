"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { waterfallVariant } from "@/lib/motion";

const BADGE: Record<string, string> = {
  sky: "text-sky-400/60",
  emerald: "text-emerald-400/80",
};

/**
 * One step panel of the setup wizard: a serif title with an index badge over a
 * rule, then the panel's body.
 *
 * Thirteen copies of this header used to be inlined in `src/app/setup/page.tsx`,
 * which was carrying 52 lines of pure repetition while sitting 16 lines under its
 * God-component ceiling — the state where the ratchet stops constraining
 * anything. `tone` and `gap` exist because the hardware-check panel really does
 * differ (emerald badge, wider rhythm); nothing else is parameterized.
 */
export function WizardSection({
  title,
  index,
  tone = "sky",
  gap = "space-y-6",
  children,
}: {
  title: string;
  index: string;
  tone?: "sky" | "emerald";
  gap?: string;
  children: ReactNode;
}) {
  return (
    <motion.section variants={waterfallVariant} className={gap}>
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
        <h2 className="text-2xl font-serif tracking-tight text-slate-800">{title}</h2>
        <span className={`${BADGE[tone]} font-mono text-sm font-bold`}>{index}</span>
      </div>
      {children}
    </motion.section>
  );
}
