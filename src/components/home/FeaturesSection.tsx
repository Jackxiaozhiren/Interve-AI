import React from "react";

export function FeaturesSection() {
  return (
    <section id="features" className="flex flex-col items-center gap-16">
      <div className="text-center">
        <h2 className="text-3xl font-semibold text-[var(--interve-text-title)] mb-4">核心优势</h2>
        <p className="text-[var(--interve-text-secondary)]">重塑招聘流程，带来无与伦比的体验</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {/* Feature 1 */}
        <div className="interve-glass p-8 rounded-[var(--radius-xl)] flex flex-col gap-4 transition-transform hover:-translate-y-1 hover:shadow-[var(--interve-shadow-md)] duration-[var(--motion-moderate)]">
          <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)] flex items-center justify-center mb-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--interve-text-title)]">智能面试助手</h3>
          <p className="text-[14px] text-[var(--interve-text-secondary)] leading-relaxed">
            自适应追问机制，根据候选人的回答动态调整面试深度，全面考察技术与软技能。
          </p>
        </div>

        {/* Feature 2 */}
        <div className="interve-glass p-8 rounded-[var(--radius-xl)] flex flex-col gap-4 transition-transform hover:-translate-y-1 hover:shadow-[var(--interve-shadow-md)] duration-[var(--motion-moderate)]">
          <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--interve-success-surface)] text-[var(--interve-success-text)] flex items-center justify-center mb-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--interve-text-title)]">实时反馈分析</h3>
          <p className="text-[14px] text-[var(--interve-text-secondary)] leading-relaxed">
            面试过程中实时生成能力图谱与多维评价，帮助企业高效筛选高匹配度人才。
          </p>
        </div>

        {/* Feature 3 */}
        <div className="interve-glass p-8 rounded-[var(--radius-xl)] flex flex-col gap-4 transition-transform hover:-translate-y-1 hover:shadow-[var(--interve-shadow-md)] duration-[var(--motion-moderate)]">
          <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--interve-warning-surface)] text-[var(--interve-warning-text)] flex items-center justify-center mb-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--interve-text-title)]">个性化学习</h3>
          <p className="text-[14px] text-[var(--interve-text-secondary)] leading-relaxed">
            为求职者提供详细的复盘报告与针对性提升建议，助力职业技能的快速成长。
          </p>
        </div>
      </div>
    </section>
  );
}
