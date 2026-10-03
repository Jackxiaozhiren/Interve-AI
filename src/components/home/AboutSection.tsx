import React from "react";

/**
 * No metrics and no customer quotes live here, and that is deliberate: the
 * previous version claimed 10,000+ users, 50,000+ completed interviews, a 95%
 * satisfaction rate and a testimonial attributed to a named engineer at a named
 * employer. None of it had a source — there is no analytics store, no survey,
 * and no customer. StatsStrip above renders the numbers this app can actually
 * read (local IndexedDB session counts, with an em dash when unavailable), so
 * this section carries intent only. tests/unit/no-unverifiable-claims.test.ts
 * keeps it that way.
 */
export function AboutSection() {
  return (
    <section id="about" className="w-full flex flex-col items-center gap-12">
      <div className="text-center max-w-3xl">
        <h2 className="text-3xl font-semibold text-[var(--interve-text-title)] mb-4">关于 Interve AI</h2>
        <p className="text-[var(--interve-text-secondary)] leading-relaxed mb-8">
          Interve AI 由一群热爱技术与教育的工程师打造，致力于通过人工智能重新定义面试体验。我们相信每个人都值得一次公平、高效、深度的面试机会。
        </p>
        <p className="text-sm text-[var(--interve-text-secondary)] leading-relaxed">
          产品仍在早期：没有付费档位，没有企业版，也没有销售联系渠道。
          练习题目由模型按你的目标与岗位实时生成，不存在固定题库。
        </p>
      </div>
    </section>
  );
}
