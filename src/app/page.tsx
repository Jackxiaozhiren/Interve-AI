"use client";

import React from "react";
import Link from "next/link";
import { InterveTopNav, InterveNavLink, InterveButton } from "@/components/interve-ui";
import { Footer } from "@/components/layout/Footer";
import {
  HeroSection,
  FeaturesSection,
  DemoSection,
  PricingSection,
  AboutSection,
  CtaSection
} from "@/components/home";

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
        <InterveNavLink href="#home" active onClick={() => { document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' }); }}>首页</InterveNavLink>
        <InterveNavLink href="#features" onClick={() => { document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }}>功能</InterveNavLink>
        <InterveNavLink href="#pricing" onClick={() => { document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }}>定价</InterveNavLink>
        <InterveNavLink href="#about" onClick={() => { document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }); }}>关于</InterveNavLink>
      </InterveTopNav>

      <main className="pt-32 pb-16 px-6 lg:px-16 max-w-7xl mx-auto flex flex-col gap-32 responsive-container">
        <HeroSection />
        <FeaturesSection />
        <DemoSection />
        <PricingSection />
        <AboutSection />
        <CtaSection />
      </main>

      <Footer />
    </>
  );
}
