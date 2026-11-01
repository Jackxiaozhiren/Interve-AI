import React from "react";

export function FeaturesSection() {
  return (
    <section id="features" className="flex flex-col items-center gap-16">
      <div className="text-center">
        <h2 className="text-3xl font-semibold text-[var(--interve-text-title)] mb-4">核心优势</h2>
        <p className="text-[var(--interve-text-secondary)]">从开练到复盘，每一步都站在你这边</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {/* Feature 1 */}
        <div className="interve-glass p-8 rounded-[var(--radius-xl)] flex flex-col gap-4 transition-transform hover:-translate-y-1 hover:shadow-[var(--interve-shadow-md)] duration-[var(--motion-moderate)]">
          <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)] flex items-center justify-center mb-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--interve-text-title)]">追问跟着你的回答走</h3>
          <p className="text-[14px] text-[var(--interve-text-secondary)] leading-relaxed">
            从自我介绍到项目深挖，你提到一个数字，它就问这个数字怎么来的；你说「参与了」，它就问哪一部分是你做的。
          </p>
        </div>

        {/* Feature 2 */}
        <div className="interve-glass p-8 rounded-[var(--radius-xl)] flex flex-col gap-4 transition-transform hover:-translate-y-1 hover:shadow-[var(--interve-shadow-md)] duration-[var(--motion-moderate)]">
          <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--interve-success-surface)] text-[var(--interve-success-text)] flex items-center justify-center mb-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--interve-text-title)]">每个结论都有出处</h3>
          <p className="text-[14px] text-[var(--interve-text-secondary)] leading-relaxed">
            报告里的每条判断都指回你的原话，标出是第几轮说的，点一下就能跳回那句话。没有证据就不下结论。
          </p>
        </div>

        {/* Feature 3 */}
        <div className="interve-glass p-8 rounded-[var(--radius-xl)] flex flex-col gap-4 transition-transform hover:-translate-y-1 hover:shadow-[var(--interve-shadow-md)] duration-[var(--motion-moderate)]">
          <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--interve-warning-surface)] text-[var(--interve-warning-text)] flex items-center justify-center mb-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--interve-text-title)]">练完知道下一步</h3>
          <p className="text-[14px] text-[var(--interve-text-secondary)] leading-relaxed">
            最弱的维度排在最前面，配一条能当天做完的动作——不是「多练习」，是「重录第 2 题，把结果量化成一个数字」。
          </p>
        </div>
      </div>
    </section>
  );
}
