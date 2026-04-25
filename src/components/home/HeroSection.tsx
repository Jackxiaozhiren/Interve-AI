import React from "react";
import Link from "next/link";
import { InterveButton } from "@/components/interve-ui";

export function HeroSection() {
  return (
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
  );
}
