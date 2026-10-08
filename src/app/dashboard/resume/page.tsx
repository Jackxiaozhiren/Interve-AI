"use client";

import { ACCEPTED_RESUME_KINDS, MAX_RESUME_MB } from "@/lib/uploads";
import Link from "next/link";
import { InterveButton } from "@/components/interve-ui";
import { PageHeader } from "@/components/data";

/**
 * This page imitated an upload surface it could not drive. The dashed dropzone
 * had `onDragOver` / `onDragLeave` / `onDrop`, but `onDrop` only cleared a
 * highlight — the dropped `File` was never read — and `选择文件` was a button
 * with no `<input>` and no handler, so the primary action on a page titled
 * "上传简历文件" did nothing at all. Below it, a 已分析简历 section asserted
 * "您还没有上传过简历" from a constant: nothing on this page fetches, and a
 * parsed resume is stored on the interview record (`Interview.resumeText`), not
 * in a per-user library, so that list could never populate. One line also
 * rendered the literal text "{MAX_RESUME_MB}MB" to the user, because it was a
 * plain string rather than a template.
 *
 * The working path is step 1 of the setup wizard
 * (`useResumeIntegration` → `POST /api/parse-resume`), so this page now points
 * there instead of pretending to be it. A real in-page uploader is a feature
 * decision, not a fix.
 */
export default function ResumeDashboard() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Step 1 · Prepare"
        title="简历分析中心"
        description="上传您的简历，获取深度优化建议与岗位匹配度分析。"
      />

      <div className="w-full max-w-3xl p-12 mt-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center border-[var(--interve-border-light)] bg-white/50">
        <div className="w-16 h-16 mb-4 rounded-full bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)] flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        </div>
        <h3 className="text-xl font-semibold text-[var(--interve-text-title)] mb-2">上传简历文件</h3>
        <p className="text-sm text-[var(--interve-text-secondary)] mb-6">
          {`支持 ${ACCEPTED_RESUME_KINDS.join(" / ")}，最大 ${MAX_RESUME_MB}MB。解析在面试准备向导的第一步完成，结果保存在该场面试的记录里。`}
        </p>
        <Link href="/setup">
          <InterveButton>前往面试准备向导</InterveButton>
        </Link>
      </div>
    </div>
  );
}
