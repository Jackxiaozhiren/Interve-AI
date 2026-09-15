import React from "react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[var(--interve-divider)] bg-white/50 backdrop-blur-sm mt-auto">
      <div className="max-w-7xl mx-auto px-6 lg:px-16 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded bg-[var(--interve-brand-accent)] flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <span className="font-semibold text-[15px] text-[var(--interve-text-title)]">Interve AI</span>
            </div>
            <p className="text-sm text-[var(--interve-text-secondary)]">
              智能、自然、专业的下一代 AI 面试平台。
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-[14px] text-[var(--interve-text-title)] mb-1">产品</h3>
            <Link href="/practice" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">面试题库</Link>
            <Link href="/setup" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">开始面试</Link>
            <Link href="/dashboard" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">控制台</Link>
            <Link href="/recruiter" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">企业版</Link>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-[14px] text-[var(--interve-text-title)] mb-1">资源</h3>
            <Link href="/landing" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">产品介绍</Link>
            <a href="/api/session" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">API 状态</a>
            <Link href="/chat" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">AI 对话</Link>
            <Link href="/practice" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">面试题库</Link>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-[14px] text-[var(--interve-text-title)] mb-1">法律</h3>
            <Link href="/dashboard/privacy" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">隐私政策</Link>
            <Link href="/dashboard/settings" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">设置</Link>
            <Link href="/login" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">登录</Link>
          </div>
        </div>
        
        <div className="pt-8 border-t border-[var(--interve-divider)] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-[var(--interve-text-secondary)]">
            © {new Date().getFullYear()} Interve AI. 保留所有权利。
          </p>
          <div className="flex gap-4">
            <a href="#" aria-label="X (Twitter)" className="text-[var(--interve-text-placeholder)] hover:text-[var(--interve-text-title)] transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
            </a>
            <a href="#" aria-label="GitHub" className="text-[var(--interve-text-placeholder)] hover:text-[var(--interve-text-title)] transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
