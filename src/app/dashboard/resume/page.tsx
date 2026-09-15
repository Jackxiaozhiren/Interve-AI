"use client";

import React, { useState } from "react";
import { InterveButton } from "@/components/interve-ui";
import { EmptyState, PageHeader } from "@/components/data";

export default function ResumeDashboard() {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Step 1 · Prepare"
        title="简历分析中心"
        description="上传您的简历，获取深度优化建议与岗位匹配度分析。"
      />
      
      <div 
        className={`w-full max-w-3xl p-12 mt-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-colors duration-200 ${
          isDragging 
            ? "border-[var(--interve-brand-accent)] bg-[var(--interve-brand-surface)]" 
            : "border-[var(--interve-border-light)] hover:border-[var(--interve-brand-accent)]/50 bg-white/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
      >
        <div className="w-16 h-16 mb-4 rounded-full bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)] flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        </div>
        <h3 className="text-xl font-semibold text-[var(--interve-text-title)] mb-2">上传简历文件</h3>
        <p className="text-sm text-[var(--interve-text-secondary)] mb-6">支持 PDF, DOCX, 或 TXT 格式，最大 10MB</p>
        <InterveButton>选择文件</InterveButton>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-[var(--interve-text-title)] mb-4">已分析简历</h2>
        <div className="interve-glass rounded-xl border border-[var(--interve-border-light)] overflow-hidden">
          <EmptyState
            title="您还没有上传过简历"
            description="支持 PDF / DOCX / TXT，最大 10MB。上传后将在此生成分析报告。"
          />
        </div>
      </div>
    </div>
  );
}
