"use client";

import { useEffect, useState } from "react";
import { ChartBar } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import type { DimensionView } from "@/lib/eval-compat";
import {
  COHORT_MIN_CELL,
  COHORT_WINDOW_DAYS,
  POSITION_LABEL,
  positionOf,
  suppressSmallCells,
  type CohortCell,
} from "@/lib/cohort";

interface CohortCardProps {
  /** Role direction from the session; null on legacy rows. */
  interviewType: string | null;
  rubricId: string | null;
  dimensions: DimensionView[];
  /** False for a local-only session: there is no row to compare against. */
  enabled: boolean;
}

/**
 * "How does this compare to people who did the same kind of interview?"
 *
 * The number is a distribution, never a person: the SQL hard-codes a floor of
 * ten reports and the window, and `suppressSmallCells` re-checks it here so a
 * response that ignored the floor still cannot render. When the cohort is thin
 * the card says so instead of showing a percentage — a percentage over four
 * reports reads as a fact and is not one.
 */
export function CohortCard({ interviewType, rubricId, dimensions, enabled }: CohortCardProps) {
  const [cells, setCells] = useState<CohortCell[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || !interviewType || !rubricId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("cohort_benchmarks", {
          p_interview_type: interviewType,
          p_rubric_id: rubricId,
        });
        if (cancelled) return;
        if (error) {
          setFailed(true);
          return;
        }
        setCells(suppressSmallCells(data));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, interviewType, rubricId]);

  if (!enabled || !interviewType || !rubricId) return null;

  const byDimension = new Map((cells ?? []).map((cell) => [cell.dimensionId, cell]));
  const comparable = dimensions.filter(
    (dim) => dim.anchorLevel !== null && byDimension.has(dim.id)
  );

  return (
    <section
      className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      aria-labelledby="cohort-heading"
    >
      <h3
        id="cohort-heading"
        className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-3"
      >
        <ChartBar className="w-6 h-6 text-sky-500" weight="fill" />
        同类面试基准
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        同岗位方向、同一评分标准，近 {COHORT_WINDOW_DAYS} 天，每个格子至少 {COHORT_MIN_CELL} 份报告才显示。
      </p>

      {failed ? (
        <p className="text-sm text-slate-600">暂时读不到同类基准，这不影响你的报告。</p>
      ) : cells === null ? (
        <p className="text-sm text-slate-500">正在读取同类基准…</p>
      ) : comparable.length === 0 ? (
        <p className="text-sm text-slate-600 leading-relaxed">
          同类样本还不够 {COHORT_MIN_CELL} 份，所以这里不显示分布。样本太小时，任何百分比都会读起来像结论，而它并不是。
        </p>
      ) : (
        <ul className="space-y-3">
          {comparable.map((dim) => {
            const level = dim.anchorLevel;
            const cell = byDimension.get(dim.id);
            if (level === null || !cell) return null;
            return (
              <li
                key={dim.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{dim.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    你 {level} · 同类中位 {Number(cell.p50.toFixed(1))} · 样本 {cell.n} 份
                  </p>
                </div>
                <span className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-lg">
                  {POSITION_LABEL[positionOf(level, cell)]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
