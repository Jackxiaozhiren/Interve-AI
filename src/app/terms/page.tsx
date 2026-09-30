import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "服务条款",
  description: "Interve AI 的使用边界：它是练习工具而非招聘系统，以及你与这项服务之间的基本约定。",
};

/**
 * Mirrors src/app/privacy/page.tsx: one owner for TOC and section order, prose
 * unwrapped so JSX does not inject spaces between Chinese characters, and an
 * 技术依据 line wherever the promise is enforced in code rather than in wording.
 */
const SECTIONS = [
  { id: "nature", title: "这项服务的性质" },
  { id: "yours", title: "你输入的内容" },
  { id: "account", title: "账户与保存" },
  { id: "fair", title: "合理使用" },
  { id: "limits", title: "配额与限流" },
  { id: "changes", title: "可用性与变更" },
  { id: "disclaimer", title: "免责与责任" },
  { id: "end", title: "终止与联系" },
] as const;

const UPDATED = "2026-09-30";

const REPO_ISSUES = "https://github.com/Jackxiaozhiren/Interve-AI/issues";

function Evidence({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 border-l-2 border-emerald-500/40 pl-3 text-[13px] leading-relaxed text-slate-500">
      <span className="font-semibold text-slate-600">技术依据：</span>
      {children}
    </p>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 font-serif text-[1.6rem] leading-tight tracking-tight text-[#111111]">
      {children}
    </h2>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f8fafd]">
      <div className="mx-auto grid max-w-5xl gap-x-10 gap-y-12 px-6 py-16 lg:grid-cols-[176px_minmax(0,68ch)] lg:py-20">
        <nav aria-label="目录" className="hidden lg:sticky lg:top-16 lg:block lg:self-start">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">目录</p>
          <ol className="mt-3 space-y-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-[13px] leading-snug text-slate-500 hover:text-sky-600">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div>
          <header>
            <Link href="/landing" className="text-[13px] font-semibold text-sky-600 hover:underline">
              ← 返回 Interve AI
            </Link>
            <h1 className="mt-4 font-serif text-[2.5rem] leading-none tracking-tight text-[#111111]">服务条款</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-500">最近更新：{UPDATED}</p>
            <p className="mt-6 text-[17px] leading-relaxed text-slate-700">
              一句话版本：这是一个给你自己练习用的工具。它的输出不构成录用建议，也不应被当作任何雇佣决策的依据；你输入的内容仍然是你的。
            </p>
          </header>

          <div className="mt-14 space-y-14">
            <section>
              <H2 id="nature">这项服务的性质</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                Interve AI 提供模拟面试、结构化反馈与练习闭环。它面向求职者本人，不是招聘方用来筛选候选人的系统，也不会给出「录用 / 不录用」的结论。报告里的分数衡量的是你某一次作答与评分标准的贴合度，不是你的能力上限，更不是任何公司对你的评价。
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                把这里的任何输出提交给第三方（雇主、学校、平台）之前，请你自行判断它是否适用。
              </p>
              <Evidence>
                产品红线由 <code>tests/integration/prohibitions.test.ts</code> 锁住：不生成录用结论、不做情绪与外貌评判、不推断受保护属性。
              </Evidence>
            </section>

            <section>
              <H2 id="yours">你输入的内容</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                你粘贴的简历、职位描述、作答、代码与架构图，权利归你或原权利人。我们不主张对其的任何所有权，也不会把它用于训练模型或对外出售。我们只为完成你请求的那次分析而处理它，处理方式见 <Link href="/privacy" className="font-semibold text-sky-600 hover:underline">隐私政策</Link>。
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                作为交换，请只输入你有权使用的内容：不要上传他人的个人信息（例如把同事写的评价原文贴进来），也不要上传你无权处置的机密材料（前雇主的内部代码、未公开文档、带水印的付费题库）。
              </p>
            </section>

            <section>
              <H2 id="account">账户与保存</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                需要保存报告与历史，请用 Google 或 GitHub 登录。邮箱通道是体验用的：可以立刻开始一场面试，但系统里没有可归属的账户身份，因此内容不会被写入数据库，页面也会明确告诉你「本次面试不会保存」。
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                请保管好你的登录方式。数据按账户隔离，任何能登录你账户的人都能看到你的记录。
              </p>
              <Evidence>
                没有可归属身份时系统直接拒写内容表，而不是存成一列空归属；读取由行级安全策略 <code>auth.uid() = user_id</code> 约束。
              </Evidence>
            </section>

            <section>
              <H2 id="fair">合理使用</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                不要用它做这些事：批量生成内容转售或冒充他人产出；把服务当作公开 API 代理转供第三方；用自动化手段规避配额或限流；上传恶意负载试图攻击服务本身；把它用于对第三方进行评价或决策——它是给自己练的。
              </p>
            </section>

            <section>
              <H2 id="limits">配额与限流</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                服务运行在免费额度上，因此存在每日调用上限与请求速率限制。超限时你会收到明确的 429 与可重试时间，而不是静默失败。配额可能随上游政策调整；如果你有更大的用量需求，请提前联系我们，而不是绕过限制。
              </p>
              <Evidence>每日预算按调用者身份与来源地址共同计量，因此更换身份不会凭空多出额度。</Evidence>
            </section>

            <section>
              <H2 id="changes">可用性与变更</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                模型会更换、功能会增删、界面会调整，我们不承诺某个具体模型或某项能力长期存在。历史报告以生成时记录的评估结构呈现，不会因为模型换代而被改写。若某次变更会实质影响你已保存的数据，我们会在本页说明。
              </p>
            </section>

            <section>
              <H2 id="disclaimer">免责与责任</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                服务按「现状」和「可用」提供，不作任何明示或默示保证，包括对准确性、适用性、以及「用了就能拿到 offer」这类结果的保证。AI 生成内容可能出错、可能带有偏见，也可能与你所在行业的实际做法不符，请自行核对。
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                在法律允许的范围内，我们不对你因使用或无法使用本服务而产生的间接、偶然或后果性损失承担责任。
              </p>
            </section>

            <section>
              <H2 id="end">终止与联系</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                你随时可以停止使用，并在 <Link href="/dashboard/privacy" className="font-semibold text-sky-600 hover:underline">隐私中心</Link> 一键删除全部云端记录与本地数据。删除后我们不再保留你的内容（托管平台的短期备份除外，见隐私政策）。
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                条款异议、滥用举报或合作咨询：
                <a href={REPO_ISSUES} className="ml-1 font-semibold text-sky-600 hover:underline">
                  在仓库提 issue
                </a>
                。
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
