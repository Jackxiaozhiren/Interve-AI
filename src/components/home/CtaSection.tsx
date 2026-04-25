import React from "react";
import Link from "next/link";
import { InterveButton } from "@/components/interve-ui";

export function CtaSection() {
  return (
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
  );
}
