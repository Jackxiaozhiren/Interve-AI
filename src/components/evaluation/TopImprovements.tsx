"use client";

import { ArrowDown } from "@phosphor-icons/react";
import type { CitedImprovement } from "@/lib/report-improvements";

/**
 * P0-2: the first thing the report says.
 *
 * The reader is the candidate (§1.2 principle 2), so the block answers "what do
 * I change next, and what did I actually say that makes you think so" — three
 * items, weakest dimension first, each one sentence plus one quote from their own
 * turn. The quote is a button, not decoration: clicking it takes them to the
 * words in the transcript and marks them, because a citation you cannot open is
 * a claim you have to take on faith.
 *
 * Quotes print as fragments, never whole answers (PRD F-4 says 原话片段), and a
 * sentence already cited by an earlier item is not printed a second time — the
 * advice differs, the evidence does not, so the repeat points back instead.
 */
export function TopImprovements({
  items,
  onCite,
}: {
  items: CitedImprovement[];
  onCite: (messageId: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="top-improvements-heading"
      className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
    >
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h2 id="top-improvements-heading" className="text-lg font-bold text-slate-800">
          本次最该改的三件事
        </h2>
        <p className="text-xs text-slate-500">按最弱的维度排，每条都指回你的原话</p>
      </div>

      <ol className="space-y-2.5">
        {items.map((item, index) => (
          <li key={item.dimensionId} className="flex items-start gap-4">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-600">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-relaxed text-slate-800">{item.sentence}</p>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                {item.round !== null && item.messageId !== null ? (
                  <button
                    type="button"
                    onClick={() => onCite(item.messageId as string)}
                    className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
                  >
                    <ArrowDown className="h-3 w-3" aria-hidden="true" />
                    第 {item.round} 轮
                  </button>
                ) : item.repeatOf === null ? (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">
                    原话
                  </span>
                ) : null}
                {item.repeatOf !== null ? (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">
                    同第 {item.repeatOf} 条原话
                  </span>
                ) : (
                  <q className="line-clamp-1 min-w-0 flex-1 text-[13px] italic leading-relaxed text-slate-600">
                    {item.fragment}
                  </q>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
