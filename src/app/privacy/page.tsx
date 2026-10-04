import type { Metadata } from "next";
import Link from "next/link";
import { EXTERNAL_LINKS } from "@/utils/constants";

export const metadata: Metadata = {
  title: "隐私政策",
  description:
    "Interve AI 收集什么、存在哪里、发给谁、保留多久，以及每一条承诺在代码里由什么强制。",
};

/**
 * A public policy for a product that ingests resumes and interview transcripts is
 * only worth reading if its claims can be checked, so each material section ends
 * with the mechanism that enforces it. SECTIONS is the single owner of both the
 * table of contents and the section order — a TOC written apart from the headings
 * is how such pages drift.
 *
 * Prose stays on one line per paragraph on purpose: JSX collapses a wrapped
 * newline into an ASCII space, which reads as a hole between Chinese characters.
 * tests/unit/privacy-claims.test.ts asserts both the claims and that wrapping.
 */
const SECTIONS = [
  { id: "collect", title: "我们收集什么" },
  { id: "audio", title: "音频与摄像头" },
  { id: "models", title: "哪些内容会发给模型" },
  { id: "access", title: "谁能看到你的数据" },
  { id: "never", title: "我们不做的事" },
  { id: "local", title: "存在你浏览器里的东西" },
  { id: "logs", title: "日志与遥测" },
  { id: "control", title: "你的控制权" },
  { id: "third", title: "第三方与托管" },
  { id: "changes", title: "变更与联系" },
] as const;

const UPDATED = "2026-09-30";

const REPO_ISSUES = EXTERNAL_LINKS.issues;

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

const INVENTORY_ROWS: [string, string, string][] = [
  ["简历正文", "数据库 interviews.resume_text", "把提问和差距分析锚定在你的真实经历上"],
  ["职位描述", "数据库 interviews.job_description", "按目标岗位出题与评估"],
  ["面试对话记录", "数据库 interviews.transcript", "生成报告、回放与进度"],
  ["表达指标（语速、填充词、时长）", "数据库 interviews.delivery_stats", "可观察的口头表达反馈"],
  ["评估结果与原文证据", "数据库 interviews.evaluation_v2", "每一项评分都带可回溯的引用"],
  ["练习作答与评分", "数据库 practice_sessions", "重做与对比的练习闭环"],
  ["系统设计白板截图", "仅在你点击「分析」时发送，不入库", "对你画的架构图给出反馈"],
  ["原始麦克风音频", "不入库：在这台浏览器内转写后即丢弃", "语音转文字需要音频，存储不需要"],
  ["摄像头画面", "不上传、不分析，仅本机预览", "说话时的自我查看"],
];

export default function PrivacyPage() {
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
            <Link href="/" className="text-[13px] font-semibold text-sky-600 hover:underline">
              ← 返回 Interve AI
            </Link>
            <h1 className="mt-4 font-serif text-[2.5rem] leading-none tracking-tight text-[#111111]">隐私政策</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-500">最近更新：{UPDATED}</p>
            <p className="mt-6 text-[17px] leading-relaxed text-slate-700">
              这是一款练习工具，不是招聘方的评估系统。你粘贴的简历、你说的每一句话、你画的每张架构图，都只服务于生成你自己的报告。本页最重要的两句是：<strong className="font-semibold text-slate-900">你的原始音频不出这台浏览器；你的数据默认只有你能读到。</strong>
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-500">
              每一节末尾的「技术依据」指出这条承诺在系统里由什么强制。如果哪天代码与本页不一致，以代码为准，并请告诉我们。
            </p>
          </header>

          <div className="mt-14 space-y-14">
            <section>
              <H2 id="collect">我们收集什么</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                只有你主动输入的东西。没有埋点、没有第三方广告 SDK、不读取通讯录或相册。
              </p>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left text-[14px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-[12px] uppercase tracking-wider text-slate-400">
                      <th className="py-2 pr-4 font-semibold">数据</th>
                      <th className="py-2 pr-4 font-semibold">存在哪</th>
                      <th className="py-2 font-semibold">为什么</th>
                    </tr>
                  </thead>
                  <tbody>
                    {INVENTORY_ROWS.map(([what, where, why]) => (
                      <tr key={what} className="border-b border-slate-100 align-top">
                        <td className="py-3 pr-4 font-medium text-slate-800">{what}</td>
                        <td className="py-3 pr-4 text-slate-500">{where}</td>
                        <td className="py-3 text-slate-500">{why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-[14px] leading-relaxed text-slate-500">
                保留期：以上云端数据保留到你删除该场面试为止；删除即从应用层移除。
              </p>
              <Evidence>
                云端表为 <code>interviews / practice_sessions / evaluations / assessments / achievements / telemetry / orama_index</code>。全仓没有任何对象存储上传路径，音频与截图不落库。
              </Evidence>
            </section>

            <section>
              <H2 id="audio">音频与摄像头</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                面试时你的语音确实在被转写，但转写发生在这一页里：录音在浏览器内解码成 PCM，交给一个本地 Web Worker，由跑在你设备上的 Whisper 模型出文字。原始音频不上传、不保存，转写完成后即丢弃。
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                摄像头只用于自我预览。它不做人脸检测、不做表情识别、不做任何分析——报告里没有一个字来自你的画面。
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                一处必要的坦白：模型权重第一次使用时需要从 Hugging Face 的 CDN 下载，这次下载会把你的 IP 暴露给该 CDN。之后的转写全程不经过我们的服务器。
              </p>
              <Evidence>
                <code>src/workers/whisper.worker.ts</code> 用 <code>@huggingface/transformers</code> 跑 <code>Xenova/whisper-base</code>；<code>CameraSelfView</code> 只取本地流，并在无障碍标签里写明 no analysis performed。
              </Evidence>
            </section>

            <section>
              <H2 id="models">哪些内容会发给模型</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                评估必须由语言模型完成，因此文本会离开我们的服务器、到达模型提供方。具体是：你的对话轮次、简历与职位描述中被截取用于出题和对齐的片段、你在代码白板上的代码，以及你主动点击「分析」时导出的那张架构图（PNG）。
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                默认提供方是智谱 AI（glm-4-flash / glm-4.7-flash，接口域名 open.bigmodel.cn）。仅当链接显式带上 <code>?model=</code> 参数时才会走 OpenAI、Google Gemini 或 OpenRouter；未识别的取值一律回落到默认提供方。
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                我们不会用你的内容训练模型，也不会把它提供给你面试的公司——这个产品本身不出录用结论，见「我们不做的事」。
              </p>
              <Evidence>
                提供方与模型 ID 集中在 <code>src/ai/providers/registry.ts</code>；模型路由只认白名单参数，每日调用有熔断与限流。
              </Evidence>
            </section>

            <section>
              <H2 id="access">谁能看到你的数据</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                行级安全（RLS）在数据库层强制：每一行都带 <code>user_id</code>，读写策略要求 <code>auth.uid() = user_id</code>。也就是说，即使有人拿到你的接口地址，也读不到不属于他账户的面试记录。
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                如果你走的是邮箱「演示」通道，系统里没有可归属的账户身份，此时我们<strong className="font-semibold text-slate-900">拒绝</strong>把内容写进数据库——宁可让它不保存，也不保存成谁都能读的行。这就是页面会提示「本次面试不会保存」的原因。
              </p>
              <Evidence>
                <code>003_per_operation_policies.sql</code> 建立 Owner select/insert/update/delete 策略；<code>006_close_anon_bridge_content_tables.sql</code> 关掉了匿名写入通道。
              </Evidence>
            </section>

            <section>
              <H2 id="never">我们不做的事</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                下面不是「目前没有」，而是被测试锁住、写进代码就会让 CI 变红的产品红线：
              </p>
              <ul className="mt-4 space-y-2 text-[15px] leading-relaxed text-slate-600">
                <li>· 不做人脸特征提取、表情识别或任何外貌评分</li>
                <li>· 不做口音、方言或语音音色上的评判</li>
                <li>· 不推断性别、年龄、民族、宗教、政治立场、性取向、残障等受保护属性</li>
                <li>· 不输出「录用 / 不录用」结论——这是练习工具，招聘决定属于人</li>
                <li>· 不做职场情绪识别，也不把情绪当作评分维度</li>
              </ul>
              <Evidence>
                <code>tests/integration/prohibitions.test.ts</code> 静态锁住上述能力，包括禁止引入人脸关键点库与情绪分数读取路径。
              </Evidence>
            </section>

            <section>
              <H2 id="local">存在你浏览器里的东西</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                为了刷新页面后不丢工作，本地会存：面试会话快照（<code>interve_session_*</code>，30 天自动过期）、代码白板内容与运行日志、系统设计画板内容、界面语言、引导是否看过。登录状态由一个 HttpOnly Cookie 承载，有效期 24 小时。
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                这些都在你的设备上，清除浏览器数据即可移除；隐私中心里也有一键清理本地数据的按钮。
              </p>
              <Evidence>
                快照过期由 <code>SESSION_TTL_MS</code>（30 天）决定；会话 Cookie 为 HMAC 签名、<code>HttpOnly</code>，其 <code>Max-Age</code> 取自同一个 24 小时常量。
              </Evidence>
            </section>

            <section>
              <H2 id="logs">日志与遥测</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                服务端日志是结构化、不含正文的：接口名、请求 ID、状态码、耗时、模型名、是否走了兜底、以及 token 用量。你的简历内容、对话文本、代码不会出现在日志里。
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                另有一处自监控：你的浏览器会记录本应用自己接口的耗时与成功/失败状态，用于在控制台展示性能面板。它不记录请求内容，也不发送到任何第三方分析平台。
              </p>
              <Evidence>
                <code>src/lib/api/logging.ts</code> 的字段集合就是全部；前端遥测只写 <code>endpoint / latencyMs / status / timestamp</code>。
              </Evidence>
            </section>

            <section>
              <H2 id="control">你的控制权</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                登录后的隐私中心可以直接做四件事，不需要联系我们：
              </p>
              <ul className="mt-4 space-y-2 text-[15px] leading-relaxed text-slate-600">
                <li>· 导出：把面试与练习数据下载成一份 JSON</li>
                <li>· 删除单场：连同其云端记录一并移除</li>
                <li>· 删除全部：逐条删除，失败项会明确告诉你哪几条没删掉</li>
                <li>· 清理本地数据：移除浏览器内的草稿与快照（保留登录与语言偏好）</li>
              </ul>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                删除后数据从我们的数据库移除。托管平台自身可能保留短周期的备份副本，那部分遵循 Supabase 与 Vercel 的备份策略，我们无法单独延长或缩短。
              </p>
              <Evidence>删除失败会被收集并如实报告，而不是弹一句「已删除」了事。</Evidence>
            </section>

            <section>
              <H2 id="third">第三方与托管</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                应用托管在 Vercel，数据库与身份认证使用 Supabase，模型推理见上文。此外浏览器会从这些地址加载静态资源，因此对方会看到常规的访问日志（含 IP）：Hugging Face CDN（语音与语音合成模型权重）与 jsDelivr（代码编辑器）。字体不来自第三方：本项目不使用 next/font、外链字体样式表或任何远程字体文件，界面字体由你设备本地已安装的字体渲染。
              </p>
              <Evidence>
                内容安全策略在 <code>src/proxy.ts</code> 声明了允许的来源；没有接入任何广告或行为分析脚本。
              </Evidence>
            </section>

            <section>
              <H2 id="changes">变更与联系</H2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                本页改动会更新顶部的日期。使用条款见 <Link href="/terms" className="font-semibold text-sky-600 hover:underline">服务条款</Link>。
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                发现本页与产品实际行为不符，或者你希望我们补一段说明，请在仓库提 issue：
                <a href={REPO_ISSUES} className="ml-1 font-semibold text-sky-600 hover:underline">
                  github.com/Jackxiaozhiren/Interve-AI
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
