"use client";

import React from "react";
import { InterveButton } from "@/components/interve-ui";

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
          <InterveButton className="w-full mt-2">开始面试</InterveButton>
        </div>

        <div className="interve-glass p-6 rounded-[var(--radius-xl)] flex flex-col gap-4 border border-[var(--interve-border-light)] shadow-sm">
          <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--interve-success-surface)] text-[var(--interve-success-text)] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--interve-text-title)]">历史记录与报告</h3>
          <p className="text-sm text-[var(--interve-text-secondary)]">查看过去所有的面试录音、对话回顾以及多维能力评估。</p>
          <InterveButton variant="secondary" className="w-full mt-2">查看记录</InterveButton>
        </div>

        <div className="interve-glass p-6 rounded-[var(--radius-xl)] flex flex-col gap-4 border border-[var(--interve-border-light)] shadow-sm">
          <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--interve-warning-surface)] text-[var(--interve-warning-text)] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--interve-text-title)]">近期概览</h3>
          <p className="text-sm text-[var(--interve-text-secondary)]">本周已完成 3 次模拟面试，综合得分上升 5%。</p>
          <InterveButton variant="secondary" className="w-full mt-2">详细数据</InterveButton>
        </div>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-[var(--interve-text-title)] mb-4">最新面试记录</h2>
        <div className="interve-glass rounded-xl border border-[var(--interve-border-light)] overflow-hidden">
          <div className="p-8 text-center text-[var(--interve-text-secondary)]">
            <svg className="w-12 h-12 mx-auto text-[var(--interve-text-placeholder)] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <p>暂无记录，立即开始您的第一次面试吧</p>
          </div>
        </div>
      </div>
    </div>
  );
}
