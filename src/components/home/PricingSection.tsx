import React from "react";
import Link from "next/link";
import { InterveButton } from "@/components/interve-ui";
import { INTERVIEW_TYPES } from "@/ai/interview/types";
import { DEFAULT_USER_BUDGET_RPD } from "@/lib/api/user-budget";
import { RATE_LIMIT_ENVELOPE } from "@/lib/api/rate-limit";

/**
 * Single tier, because there is only one tier: nothing in this repo charges
 * money (no billing route, no payment provider, no plan column on any table).
 * The three-tier grid that used to sit here offered an upgrade button wired to
 * /signup and a sales button wired to an in-page anchor — two calls to action
 * that led to a free registration and a scroll. The ceiling quoted below is
 * `DEFAULT_USER_BUDGET_RPD`, the fallback `defaultUserBudget()` returns when
 * the env override is absent, and the frequency range is
 * `RATE_LIMIT_ENVELOPE`, which `no-unverifiable-claims.test.ts` measures against
 * the `limit` values the routes hand the limiter. This sentence used to call the
 * daily ceiling 唯一限制 while the guard refuses on frequency and body size
 * first, and to count 调用 when the fuse counts requests that may each retry.
 */
export function PricingSection() {
  return (
    <section id="pricing" className="w-full flex flex-col items-center gap-12">
      <div className="text-center">
        <h2 className="text-3xl font-semibold text-[var(--interve-text-title)] mb-4">当前完全免费</h2>
        <p className="text-[var(--interve-text-secondary)] max-w-xl mx-auto">
          没有付费档位、企业版或销售流程。下面是现在就能用到的全部能力。
        </p>
      </div>

      <div className="interve-glass p-8 rounded-[var(--radius-xl)] flex flex-col gap-5 w-full max-w-md">
        <div>
          <h3 className="text-lg font-semibold text-[var(--interve-text-title)] mb-1">免费</h3>
          <p className="text-sm text-[var(--interve-text-secondary)]">全部功能，无需信用卡</p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-[var(--interve-text-title)]">¥0</span>
          <span className="text-sm text-[var(--interve-text-secondary)]">/月</span>
        </div>
        <ul className="flex flex-col gap-3 text-sm text-[var(--interve-text-body)] flex-1">
          <li>{INTERVIEW_TYPES.length} 类面试题型（行为 / 技术 / 系统设计 / 商业案例 等）</li>
          <li>简历 × 岗位描述差距分析</li>
          <li>结构化评估报告与逐题证据</li>
          <li>面试回放与针对性练习</li>
        </ul>
        <p className="text-xs text-[var(--interve-text-secondary)]">
          限制不止一处：默认每个账号（与同一网络出口共享当天额度）每类接口每天 {DEFAULT_USER_BUDGET_RPD} 次请求，另有按接口的每分钟 {RATE_LIMIT_ENVELOPE.minPerMinute}–{RATE_LIMIT_ENVELOPE.maxPerMinute} 次频率上限。服务端可调，这些只用于守住共享的免费额度。
        </p>
        <Link href="/signup">
          <InterveButton size="lg" className="w-full justify-center shadow-[var(--interve-shadow-button)]">免费注册</InterveButton>
        </Link>
      </div>
    </section>
  );
}
