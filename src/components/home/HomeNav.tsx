// H1.1 收尾：`/` 的交互岛。Server 页面不能向 client 组件传函数，
// 4 个滚动 handler 收拢在此，`src/app/page.tsx` 得以转 Server。
"use client";

import Link from "next/link";
import { InterveTopNav, InterveNavLink, InterveButton } from "@/components/interve-ui";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export function HomeNav() {
  return (
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
      <InterveNavLink href="#home" active onClick={() => scrollTo("home")}>首页</InterveNavLink>
      <InterveNavLink href="#features" onClick={() => scrollTo("features")}>功能</InterveNavLink>
      <InterveNavLink href="#pricing" onClick={() => scrollTo("pricing")}>定价</InterveNavLink>
      <InterveNavLink href="#about" onClick={() => scrollTo("about")}>关于</InterveNavLink>
    </InterveTopNav>
  );
}
