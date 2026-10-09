"use client";

import React, { useEffect, useState } from "react";
import { StatCard } from "@/components/data";
import { db } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";

/* Home Stats 条：登录账户的会话数 / 已完成率 / 题目来源。
   读不到数据或未登录时显示占位符，永不白屏；未登录不渲染成 0 次。 */

export function StatsStrip() {
  const { isAuthenticated } = useAuth();
  const [counts, setCounts] = useState<{ total: number; completed: number } | null>(null);

  // The read below is scoped to a user id, and an anonymous one answers `[]` —
  // a real zero of nothing. So no fetch runs without a session, and the derived
  // values stay null while there isn't one: signing out stops rendering the
  // previous account's numbers instead of leaving them on screen.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    db.interviews
      .orderBy("createdAt")
      .toArray()
      .then((rows) => {
        if (cancelled) return;
        setCounts({
          total: rows.length,
          completed: rows.filter((r) => r.status === "completed").length,
        });
      })
      .catch(() => {
        if (!cancelled) setCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const seen = isAuthenticated ? counts : null;
  const sessions = seen?.total ?? null;
  const completed = seen?.completed ?? null;

  const rate =
    sessions !== null && sessions > 0 && completed !== null
      ? Math.round((completed / sessions) * 100)
      : null;

  return (
    <section aria-label="数据概览" className="w-full">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="我的模拟面试"
          value={sessions ?? "—"}
          hint={
            !isAuthenticated
              ? "登录后查看你的面试记录"
              : sessions === null
                ? "暂时读取不到你的记录，请稍后再试"
                : "记录保存在你的账户数据库中"
          }
        />
        <StatCard
          label="会话完成率"
          value={rate === null ? "—" : `${rate}%`}
          progress={rate ?? undefined}
          hint="已完成 / 全部会话"
        />
        <StatCard
          label="面试题目"
          value="实时生成"
          hint="按你的目标与岗位由模型生成，没有固定题库"
        />
      </div>
    </section>
  );
}
