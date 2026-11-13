import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { hashShareToken, looksLikeShareToken, type SharePayload } from "@/lib/share";

/**
 * The page a recipient opens. No dashboard chrome, no cookie, no query to
 * `interviews`: the only capability used here is `consume_report_share`, which
 * returns the redacted snapshot and counts the open atomically.
 *
 * Expired, spent, revoked and never-existed all render the same page with the
 * same wording. Telling them apart would turn this route into an oracle for
 * which tokens are real.
 */
export const metadata: Metadata = {
  title: "分享的面试练习报告",
  description: "一份由候选人主动分享的 AI 面试练习反馈。",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ShareRow = { payload: SharePayload; expires_at: string };

function InvalidLink() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold text-slate-800">链接已失效</h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          这个分享链接已过期、已达到打开次数上限，或被分享者收回。
        </p>
        <p className="mt-2 text-xs text-slate-500">
          如果你需要查看这份报告，请让分享者重新生成一条链接。
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-6">
      <h2 className="text-sm font-bold text-slate-800 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function SharedReport({ payload, expiresAt }: { payload: SharePayload; expiresAt: string }) {
  const rate = payload.readiness.average;
  const expiry = /^\d{4}-\d{2}-\d{2}/.exec(expiresAt)?.[0] ?? expiresAt;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="space-y-1">
          <p className="text-xs text-slate-500">由候选人主动分享的练习反馈</p>
          <h1 className="text-2xl font-bold text-slate-900">面试练习报告</h1>
          <p className="text-sm text-slate-600">
            {payload.readiness.label ? `当前水平：${payload.readiness.label}` : "尚未给出水平判断"}
            {rate !== null ? ` · 平均 ${rate}/100` : ""}
          </p>
        </header>

        {payload.readiness.rationale && (
          <Section title="为什么是这个水平">
            <p className="text-sm text-slate-700 leading-relaxed">{payload.readiness.rationale}</p>
          </Section>
        )}

        {payload.roadmap && (
          <Section title="下一步练什么">
            <div className="space-y-4">
              {[
                { label: "技术重点", items: payload.roadmap.technical },
                { label: "行为与表达", items: payload.roadmap.behavioral },
                { label: "推荐资源", items: payload.roadmap.resources },
              ].map((group) =>
                group.items.length === 0 ? null : (
                  <div key={group.label}>
                    <h3 className="text-xs font-semibold text-slate-500 mb-1.5">{group.label}</h3>
                    <div className="space-y-1.5">
                      {group.items.map((item) => (
                        <p key={item} className="text-sm text-slate-700 leading-relaxed">
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </Section>
        )}

        {payload.dimensions.length > 0 && (
          <Section title="能力维度">
            <ul className="space-y-3">
              {payload.dimensions.map((dim) => (
                <li key={dim.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-slate-800">{dim.name}</span>
                    <span className="text-sm tabular-nums text-slate-700">
                      {dim.score100}
                      <span className="text-[10px] text-slate-500">/100</span>
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">{dim.rationale}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {(payload.strengths.length > 0 || payload.weaknesses.length > 0) && (
          <Section title="强项与待补">
            <div className="grid gap-4 sm:grid-cols-2">
              {payload.strengths.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-emerald-700 mb-1.5">强项</h3>
                  <ul className="space-y-1">
                    {payload.strengths.map((item) => (
                      <li key={item} className="text-sm text-slate-700">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {payload.weaknesses.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-amber-700 mb-1.5">待补</h3>
                  <ul className="space-y-1">
                    {payload.weaknesses.map((item) => (
                      <li key={item} className="text-sm text-slate-700">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Section>
        )}

        {payload.nextDrills.length > 0 && (
          <Section title="练习任务">
            <ul className="space-y-1.5">
              {payload.nextDrills.map((item) => (
                <li key={item} className="text-sm text-slate-700">
                  {item}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <footer className="pt-2 text-xs text-slate-500 leading-relaxed">
          <p>
            这是一份练习反馈，不是招聘结论；分享内容不包含逐字证据与逐题复盘。链接将在 {expiry} 失效。
          </p>
          <p className="mt-1">如果你认为其中某项判断不准确，请直接告诉分享者——报告里有他的异议入口。</p>
        </footer>
      </div>
    </main>
  );
}

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!looksLikeShareToken(token)) return <InvalidLink />;

  const tokenHash = await hashShareToken(token);
  const { data, error } = await supabase.rpc("consume_report_share", { p_token_hash: tokenHash });

  if (error) {
    // Never surface the database error to a public page; it can name tables.
    console.error("consume_report_share failed:", error);
    return <InvalidLink />;
  }

  const rows = (data ?? []) as ShareRow[];
  const row = rows[0];
  if (!row) return <InvalidLink />;

  return <SharedReport payload={row.payload} expiresAt={row.expires_at} />;
}
