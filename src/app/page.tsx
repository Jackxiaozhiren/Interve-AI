"use client";

import React from "react";
import Link from "next/link";
import { InterveTopNav, InterveNavLink, InterveButton } from "@/components/interve-ui";
import { InterveMessageCard } from "@/components/interve-ui/chat";

export default function HomePage() {
  return (
    <>
      {/* Top Navigation */}
      <InterveTopNav
        transparent
        logo={
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-[var(--interve-brand-accent)] to-[#6AA1FF] flex items-center justify-center shadow-[var(--interve-shadow-sm)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="font-semibold text-[16px] tracking-tight text-[var(--interve-text-title)]">Interve AI</span>
          </Link>
        }
        actions={
          <>
            <Link href="/login">
              <InterveButton variant="text" size="sm">登录</InterveButton>
            </Link>
            <Link href="/signup">
              <InterveButton variant="primary" size="sm" className="shadow-[var(--interve-shadow-sm)]">免费开始</InterveButton>
            </Link>
          </>
        }
      >
        <InterveNavLink href="#home" active>首页</InterveNavLink>
        <InterveNavLink href="#features">功能</InterveNavLink>
        <InterveNavLink href="#pricing">定价</InterveNavLink>
        <InterveNavLink href="#about">关于</InterveNavLink>
      </InterveTopNav>

      <main className="pt-32 pb-16 px-6 lg:px-16 max-w-7xl mx-auto flex flex-col gap-32 responsive-container">
        
        {/* Hero Section */}
        <section id="home" className="flex flex-col items-center text-center mt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-[var(--ease-primary)]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)] text-xs font-medium mb-6 ring-1 ring-[var(--interve-brand-accent)]/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--interve-brand-accent)] opacity-40"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--interve-brand-accent)]"></span>
            </span>
            Interve AI 2.0 现已发布
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-[var(--interve-text-title)] max-w-4xl mb-6 leading-[1.1]">
            面试从未如此 <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--interve-brand-accent)] to-[#8BB7FF]">
              智能与自然
            </span>
          </h1>
          <p className="text-lg lg:text-xl text-[var(--interve-text-secondary)] max-w-2xl mb-10 leading-relaxed">
            专为现代团队打造的 AI 面试平台。以极简体验驱动，帮助您准确评估候选人能力，发掘顶尖人才。
          </p>
          <div className="flex items-center gap-4">
            <Link href="/chat">
              <InterveButton size="lg" className="shadow-[var(--interve-shadow-button)]">
                立即开始对话 →
              </InterveButton>
            </Link>
            <Link href="#demo">
              <InterveButton variant="secondary" size="lg">
                观看演示
              </InterveButton>
            </Link>
          </div>
        </section>

        {/* Features Section */}
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

        {/* Demo Section */}
        <section id="demo" className="w-full flex flex-col items-center gap-12">
          <div className="w-full max-w-4xl interve-glass rounded-2xl border border-white/50 shadow-[var(--interve-shadow-card)] overflow-hidden">
            <div className="bg-white/40 border-b border-white/30 px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#FF5F56]"></div>
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E]"></div>
                <div className="w-3 h-3 rounded-full bg-[#27C93F]"></div>
              </div>
              <div className="mx-auto text-xs font-medium text-[var(--interve-text-secondary)]">AI 模拟面试演示</div>
            </div>
            <div className="p-6 md:p-8 flex flex-col gap-6 bg-white/30 backdrop-blur-md">
              <InterveMessageCard
                role="assistant"
                content="你好！我是今天的AI面试官。我们注意到你在简历中提到了丰富的 React 开发经验。能谈谈你在最近的项目中是如何处理复杂状态管理的吗？"
                timestamp="10:00"
              />
              <InterveMessageCard
                role="user"
                content="你好！在最近的电商项目中，由于涉及到购物车、用户偏好和复杂的过滤条件，我们从 Redux 迁移到了 Zustand 结合 React Query 的方案。这大大减少了样板代码，并且..."
                timestamp="10:01"
              />
              <InterveMessageCard
                role="assistant"
                content="很好的选择。React Query 处理了服务端状态，而 Zustand 管理了客户端状态。那么在迁移过程中，你们遇到了哪些性能挑战？是如何解决不必要重渲染的问题的？"
                timestamp="10:01"
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full">
          <div className="relative overflow-hidden rounded-[24px] bg-white border border-[var(--interve-border-light)] p-12 text-center shadow-[var(--interve-shadow-lg)]">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--interve-brand-surface)] to-white opacity-50"></div>
            <div className="relative z-10 flex flex-col items-center gap-6">
              <h2 className="text-3xl lg:text-4xl font-bold text-[var(--interve-text-title)]">准备好改变面试方式了吗？</h2>
              <p className="text-[var(--interve-text-secondary)] max-w-xl">
                加入数百家顶尖企业，使用 Interve AI 提升招聘效率与质量。现在注册即可获得14天免费试用。
              </p>
              <div className="mt-4">
                <Link href="/signup">
                  <InterveButton size="lg" className="shadow-[var(--interve-shadow-button)]">
                    免费创建账户
                  </InterveButton>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
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
              <h4 className="font-semibold text-[14px] text-[var(--interve-text-title)] mb-1">产品</h4>
              <a href="#features" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">核心功能</a>
              <a href="#pricing" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">定价方案</a>
              <a href="#" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">企业版</a>
              <a href="#" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">更新日志</a>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="font-semibold text-[14px] text-[var(--interve-text-title)] mb-1">资源</h4>
              <a href="#" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">帮助中心</a>
              <a href="#" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">开发者 API</a>
              <a href="#" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">博客</a>
              <a href="#" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">面试题库</a>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="font-semibold text-[14px] text-[var(--interve-text-title)] mb-1">法律</h4>
              <a href="#" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">隐私政策</a>
              <a href="#" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">服务条款</a>
              <a href="#" className="text-sm text-[var(--interve-text-secondary)] hover:text-[var(--interve-brand-accent)] transition-colors">联系我们</a>
            </div>
          </div>
          
          <div className="pt-8 border-t border-[var(--interve-divider)] flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-[var(--interve-text-secondary)]">
              © {new Date().getFullYear()} Interve AI. 保留所有权利。
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-[var(--interve-text-placeholder)] hover:text-[var(--interve-text-title)] transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
              </a>
              <a href="#" className="text-[var(--interve-text-placeholder)] hover:text-[var(--interve-text-title)] transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
