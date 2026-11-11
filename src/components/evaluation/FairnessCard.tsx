"use client";

import { ShieldCheck } from "@phosphor-icons/react";
import { formatMeasuredAt, formatRate, summarizeFairness } from "@/lib/fairness";

/**
 * Shows the candidate what the fairness audit measured, or says plainly that
 * nothing has been measured yet.
 *
 * It never renders a bare `0%` for an unmeasured audit: the whole point of the
 * card is that the number is evidence, and a zero produced by absence is not
 * evidence of fairness.
 */
export function FairnessCard({ audit }: { audit: unknown }) {
  const reading = summarizeFairness(audit);

  return (
    <section
      className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      aria-labelledby="fairness-heading"
    >
      <h3
        id="fairness-heading"
        className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-3"
      >
        <ShieldCheck className="w-6 h-6 text-teal-500" weight="fill" />
        评分公平性
      </h3>

      {!reading ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            这项对照测量还没有完成，所以这里不显示任何数字。
          </p>
          <p className="text-xs text-slate-500">
            我们把同一段回答配上不同的姓名、代词或机构背景分别评分，看结论会不会变。没有跑过对照，就不能声称评分是稳定的。
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            在 {reading.runs} 次对照评分中，有{" "}
            <strong className="text-slate-800">{reading.flips}</strong> 次的结论发生了改变，
            翻转率为{" "}
            <strong className="text-slate-800">{formatRate(reading.rate)}</strong>。
          </p>

          <ul className="space-y-2">
            {reading.cells.map((cell) => (
              <li
                key={cell.attribute}
                className="flex items-baseline justify-between gap-4 text-sm text-slate-600 border-b border-slate-100 pb-2 last:border-0 last:pb-0"
              >
                <span>{cell.label}</span>
                <span className="tabular-nums text-slate-800">
                  {formatRate(cell.rate)}
                  <span className="text-slate-500 text-xs ml-2">（{cell.n} 次）</span>
                </span>
              </li>
            ))}
          </ul>

          <p className="text-xs text-slate-500">
            测量时间 {formatMeasuredAt(reading.measuredAt)}，模型 {reading.model}。
            这是对评分稳定性的测量，不是对你的评价；样本较小时，百分比只能作为参考。
          </p>
        </div>
      )}
    </section>
  );
}
