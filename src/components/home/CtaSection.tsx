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
            把简历和目标岗位交给 Interve AI，几分钟后就有一份带原文证据的报告：哪些回答站得住、缺了哪一块、下一句该怎么说。所有记录随时可以导出或删除。
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
