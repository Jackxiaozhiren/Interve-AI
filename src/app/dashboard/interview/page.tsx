"use client";

import React from "react";
import Link from "next/link";
import { InterveButton } from "@/components/interve-ui";

/**
 * Three of this page's calls to action were inert — `开始面试`, `查看记录` and
 * `详细数据` rendered as buttons with no handler, no form and no link — and the
 * section under them claimed "最新面试记录 / 暂无记录" from a constant, which is
 * a statement about the signed-in user that nothing here measures. The real
 * destinations are the setup wizard and `/dashboard`, whose `sessions.map(...)`
 * row list is where records actually live, so the buttons are now links and the
 * unverifiable list claim is gone.
 *
 * 2026-10-09: nothing in `src/` navigated *here* either — the sidebar's "My
 * Interviews" row pointed at `/dashboard`, the same route as the row above it.
 * That row now points at this page, and the third card, which duplicated the
 * second card's destination, points at `/dashboard/resume` (also unreachable,
 * also a working signpost). `anchor-integrity`'s fourth rule keeps any future
 * page from going dark again.
 */
export default function InterviewDashboard() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--interve-text-title)] mb-2">面试模拟大厅</h1>
        <p className="text-[var(--interve-text-secondary)]">在这里开启您的 AI 模拟面试，或者查看历史记录与分析数据。</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="interve-glass p-6 rounded-[var(--radius-xl)] flex flex-col gap-4 border border-[var(--interve-border-light)] shadow-sm">
          <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--interve-text-title)]">新建模拟面试</h3>
          <p className="text-sm text-[var(--interve-text-secondary)]">自选技术栈、难度与职位，AI 将为您定制一场专属面试。</p>
          <Link href="/setup" className="mt-auto">
            <InterveButton className="w-full mt-2">开始面试</InterveButton>
          </Link>
        </div>

        <div className="interve-glass p-6 rounded-[var(--radius-xl)] flex flex-col gap-4 border border-[var(--interve-border-light)] shadow-sm">
          <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--interve-success-surface)] text-[var(--interve-success-text)] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--interve-text-title)]">历史记录与报告</h3>
          <p className="text-sm text-[var(--interve-text-secondary)]">查看过去所有的面试录音、对话回顾以及多维能力评估。</p>
          <Link href="/dashboard" className="mt-auto">
            <InterveButton variant="secondary" className="w-full mt-2">前往控制台</InterveButton>
          </Link>
        </div>

        <div className="interve-glass p-6 rounded-[var(--radius-xl)] flex flex-col gap-4 border border-[var(--interve-border-light)] shadow-sm">
          <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--interve-warning-surface)] text-[var(--interve-warning-text)] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--interve-text-title)]">简历分析</h3>
          <p className="text-sm text-[var(--interve-text-secondary)]">上传简历并解析，结果保存在该场面试的记录里。</p>
          <Link href="/dashboard/resume" className="mt-auto">
            <InterveButton variant="secondary" className="w-full mt-2">前往简历分析</InterveButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
