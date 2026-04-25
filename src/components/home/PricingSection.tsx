import React from "react";
import Link from "next/link";
import { InterveButton } from "@/components/interve-ui";

export function PricingSection() {
  return (
    <section id="pricing" className="w-full flex flex-col items-center gap-12">
      <div className="text-center">
        <h2 className="text-3xl font-semibold text-[var(--interve-text-title)] mb-4">灵活的定价方案</h2>
        <p className="text-[var(--interve-text-secondary)] max-w-xl mx-auto">无论是个人求职者还是企业团队，我们都有适合你的方案</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        {/* Free Plan */}
        <div className="interve-glass p-8 rounded-[var(--radius-xl)] flex flex-col gap-5 transition-transform hover:-translate-y-1 hover:shadow-[var(--interve-shadow-md)] duration-[var(--motion-moderate)]">
          <div>
            <h3 className="text-lg font-semibold text-[var(--interve-text-title)] mb-1">免费版</h3>
            <p className="text-sm text-[var(--interve-text-secondary)]">体验核心功能</p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-[var(--interve-text-title)]">¥0</span>
            <span className="text-sm text-[var(--interve-text-secondary)]">/月</span>
          </div>
          <ul className="flex flex-col gap-3 text-sm text-[var(--interve-text-body)] flex-1">
            <li className="flex items-center gap-2"><svg className="w-4 h-4 text-[var(--interve-success-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>每月 3 次模拟面试</li>
            <li className="flex items-center gap-2"><svg className="w-4 h-4 text-[var(--interve-success-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>基础能力报告</li>
            <li className="flex items-center gap-2"><svg className="w-4 h-4 text-[var(--interve-success-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>社区面试题库</li>
          </ul>
          <Link href="/signup">
            <InterveButton variant="secondary" size="lg" className="w-full justify-center">免费开始</InterveButton>
          </Link>
        </div>

        {/* Pro Plan */}
        <div className="relative interve-glass p-8 rounded-[var(--radius-xl)] flex flex-col gap-5 transition-transform hover:-translate-y-1 border-2 border-[var(--interve-brand-accent)]/30 shadow-[0_8px_32px_rgba(22,93,255,0.12)] duration-[var(--motion-moderate)]">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[var(--interve-brand-accent)] text-white text-xs font-semibold tracking-wide shadow-md">最受欢迎</div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--interve-text-title)] mb-1">专业版</h3>
            <p className="text-sm text-[var(--interve-text-secondary)]">求职者的最佳选择</p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-[var(--interve-brand-accent)]">¥49</span>
            <span className="text-sm text-[var(--interve-text-secondary)]">/月</span>
          </div>
          <ul className="flex flex-col gap-3 text-sm text-[var(--interve-text-body)] flex-1">
            <li className="flex items-center gap-2"><svg className="w-4 h-4 text-[var(--interve-success-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>无限次模拟面试</li>
            <li className="flex items-center gap-2"><svg className="w-4 h-4 text-[var(--interve-success-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>深度 AI 评估报告</li>
            <li className="flex items-center gap-2"><svg className="w-4 h-4 text-[var(--interve-success-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>六维能力雷达图</li>
            <li className="flex items-center gap-2"><svg className="w-4 h-4 text-[var(--interve-success-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>面试回放与复盘</li>
            <li className="flex items-center gap-2"><svg className="w-4 h-4 text-[var(--interve-success-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>个性化成长路线</li>
          </ul>
          <Link href="/signup">
            <InterveButton size="lg" className="w-full justify-center shadow-[var(--interve-shadow-button)]">立即升级</InterveButton>
          </Link>
        </div>

        {/* Enterprise Plan */}
        <div className="interve-glass p-8 rounded-[var(--radius-xl)] flex flex-col gap-5 transition-transform hover:-translate-y-1 hover:shadow-[var(--interve-shadow-md)] duration-[var(--motion-moderate)]">
          <div>
            <h3 className="text-lg font-semibold text-[var(--interve-text-title)] mb-1">企业版</h3>
            <p className="text-sm text-[var(--interve-text-secondary)]">为招聘团队量身定制</p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-[var(--interve-text-title)]">定制</span>
          </div>
          <ul className="flex flex-col gap-3 text-sm text-[var(--interve-text-body)] flex-1">
            <li className="flex items-center gap-2"><svg className="w-4 h-4 text-[var(--interve-success-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>专业版全部功能</li>
            <li className="flex items-center gap-2"><svg className="w-4 h-4 text-[var(--interve-success-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>团队协作面板</li>
            <li className="flex items-center gap-2"><svg className="w-4 h-4 text-[var(--interve-success-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>候选人管理系统</li>
            <li className="flex items-center gap-2"><svg className="w-4 h-4 text-[var(--interve-success-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>API 接入 & SSO</li>
            <li className="flex items-center gap-2"><svg className="w-4 h-4 text-[var(--interve-success-text)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>专属客户经理</li>
          </ul>
          <Link href="#about">
            <InterveButton variant="secondary" size="lg" className="w-full justify-center">联系销售</InterveButton>
          </Link>
        </div>
      </div>
    </section>
  );
}
