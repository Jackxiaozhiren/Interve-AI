"use client";

import React, { useEffect, useState } from "react";
import { StatCard } from "@/components/data";
import { db } from "@/lib/db";

/* Home Stats 条：本地会话数 / 已完成率 / 题库规模。
   读不到数据时显示占位符，永不白屏。 */

export function StatsStrip() {
  const [sessions, setSessions] = useState<number | null>(null);
  const [completed, setCompleted] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    db.interviews
      .orderBy("createdAt")
      .toArray()
      .then((rows) => {
        if (cancelled) return;
        setSessions(rows.length);
        setCompleted(rows.filter((r) => r.status === "completed").length);
      })
      .catch(() => {
        if (!cancelled) {
          setSessions(null);
          setCompleted(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rate =
    sessions !== null && sessions > 0 && completed !== null
      ? Math.round((completed / sessions) * 100)
      : null;

  return (
    <section aria-label="平台数据" className="w-full">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="本地模拟面试"
          value={sessions ?? "—"}
          hint={sessions === null ? "本地数据不可用时显示占位" : "保存在本地 IndexedDB，无需上传"}
        />
        <StatCard
          label="会话完成率"
          value={rate === null ? "—" : `${rate}%`}
          progress={rate ?? 0}
          hint="已完成 / 全部会话"
        />
        <StatCard
          label="练习题库"
          value="100+"
          hint="行为 / 技术 / 系统设计 / 领导力全覆盖"
        />
      </div>
    </section>
  );
}
