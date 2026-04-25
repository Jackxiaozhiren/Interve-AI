import React from "react";

export function AboutSection() {
  return (
    <section id="about" className="w-full flex flex-col items-center gap-12">
      <div className="text-center max-w-3xl">
        <h2 className="text-3xl font-semibold text-[var(--interve-text-title)] mb-4">关于 Interve AI</h2>
        <p className="text-[var(--interve-text-secondary)] leading-relaxed mb-8">
          Interve AI 由一群热爱技术与教育的工程师打造，致力于通过人工智能重新定义面试体验。我们相信每个人都值得一次公平、高效、深度的面试机会。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        <div className="interve-glass p-8 rounded-[var(--radius-xl)] text-center flex flex-col items-center gap-3 transition-transform hover:-translate-y-1 hover:shadow-[var(--interve-shadow-md)] duration-[var(--motion-moderate)]">
          <div className="w-14 h-14 rounded-2xl bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)] flex items-center justify-center mb-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <h3 className="text-2xl font-bold text-[var(--interve-text-title)]">10,000+</h3>
          <p className="text-sm text-[var(--interve-text-secondary)]">活跃用户</p>
        </div>
        <div className="interve-glass p-8 rounded-[var(--radius-xl)] text-center flex flex-col items-center gap-3 transition-transform hover:-translate-y-1 hover:shadow-[var(--interve-shadow-md)] duration-[var(--motion-moderate)]">
          <div className="w-14 h-14 rounded-2xl bg-[var(--interve-success-surface)] text-[var(--interve-success-text)] flex items-center justify-center mb-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <h3 className="text-2xl font-bold text-[var(--interve-text-title)]">50,000+</h3>
          <p className="text-sm text-[var(--interve-text-secondary)]">模拟面试完成</p>
        </div>
        <div className="interve-glass p-8 rounded-[var(--radius-xl)] text-center flex flex-col items-center gap-3 transition-transform hover:-translate-y-1 hover:shadow-[var(--interve-shadow-md)] duration-[var(--motion-moderate)]">
          <div className="w-14 h-14 rounded-2xl bg-[var(--interve-warning-surface)] text-[var(--interve-warning-text)] flex items-center justify-center mb-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </div>
          <h3 className="text-2xl font-bold text-[var(--interve-text-title)]">95%</h3>
          <p className="text-sm text-[var(--interve-text-secondary)]">用户满意度</p>
        </div>
      </div>

      <div className="interve-glass rounded-[var(--radius-xl)] p-10 max-w-3xl w-full text-center">
        <blockquote className="text-lg text-[var(--interve-text-body)] italic leading-relaxed mb-4">
          &quot;Interve AI 帮助我系统化提升了面试能力，每次模拟后的详细报告都让我知道具体该从哪里改进。最终顺利拿到了心仪公司的 Offer。&quot;
        </blockquote>
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--interve-brand-accent)] to-[#8BB7FF] flex items-center justify-center text-white font-bold text-sm">L</div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[var(--interve-text-title)]">李明</p>
            <p className="text-xs text-[var(--interve-text-secondary)]">前端工程师 · 腾讯</p>
          </div>
        </div>
      </div>
    </section>
  );
}
