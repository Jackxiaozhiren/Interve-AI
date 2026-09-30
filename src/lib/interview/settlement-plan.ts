import { isPersistableInterviewId } from "@/lib/api-client";
import { describeApiFailure } from "@/lib/api/read-response";

/**
 * What happens when an interview ends, decided in one place.
 *
 * The sequence used to be: fetch an evaluation, persist it, toast, then hard
 * navigate. Each step trusted the previous one, so a session whose row was never
 * created (setup falls back to `id=local-<uuid>` when its insert fails) walked
 * all four: a provider call spent on an evaluation with nowhere to live, a throw
 * from db.interviews.update() whose own message says "this session was never
 * saved to the database", a toast promising "我们将保留部分数据" that nothing
 * backed, and a navigation to /dashboard/report/local-<uuid> — a page whose read
 * is guarded by the same id rule, so it renders empty.
 *
 * These functions hold no state and perform no I/O so the three decisions can be
 * tested against the shapes that actually occur.
 */
export type UnsavedReason = "no_id" | "not_persistable" | null;

export interface SettlementPlan {
  /** Whether asking the model for an evaluation can lead anywhere. */
  shouldAnalyze: boolean;
  /** Where the user goes afterwards. "report" is only chosen for a real row. */
  destination: "report" | "dashboard";
  /** Why nothing was saved, or null when nothing was lost. */
  unsavedReason: UnsavedReason;
}

export function planSettlement(input: {
  hasMessages: boolean;
  interviewId: string | null;
}): SettlementPlan {
  const { hasMessages, interviewId } = input;

  if (!interviewId) {
    return { shouldAnalyze: false, destination: "dashboard", unsavedReason: hasMessages ? "no_id" : null };
  }
  if (!isPersistableInterviewId(interviewId)) {
    return { shouldAnalyze: false, destination: "dashboard", unsavedReason: hasMessages ? "not_persistable" : null };
  }
  return { shouldAnalyze: hasMessages, destination: "report", unsavedReason: null };
}

export interface SettlementNotice {
  title: string;
  description: string;
}

/**
 * Copy for an evaluation that did not arrive. The status is part of the message
 * on purpose: a non-2xx that is not the thin-transcript floor used to be
 * swallowed entirely, so the candidate reached an empty report with no
 * explanation and no number anyone could act on.
 */
export function analysisFailureNotice(input: {
  ok: boolean;
  status: number;
  code?: string;
  message?: string;
  malformed?: boolean;
}): SettlementNotice | null {
  if (input.ok) return null;

  if (input.status === 422 || input.code === "THIN_TRANSCRIPT") {
    return {
      title: "回答内容较薄，暂无法生成完整评估",
      description: "补充具体做法、数字和结果后重试——最弱的一次也不该只看到报错",
    };
  }

  if (input.malformed) {
    return {
      title: "评估没能生成",
      description: `${describeApiFailure({ status: input.status, malformed: true })}。本场对话记录仍在，但报告会是空的。`,
    };
  }

  return {
    title: "评估没能生成",
    description: `${describeApiFailure({ status: input.status, code: input.code, message: input.message, malformed: false })}。本场对话记录仍在，但报告会是空的。`,
  };
}

/**
 * Copy for a session that was never stored, decided from the plan rather than
 * from a caught error, so the candidate is told before the navigation instead
 * of arriving at an empty page.
 */
export function unsavedNotice(reason: Exclude<UnsavedReason, null>): SettlementNotice {
  return reason === "no_id"
    ? {
        title: "这场面试没有关联到记录",
        description: "入口缺少面试编号，所以没有可保存或可展示的报告。请从控制台重新开始一次面试。",
      }
    : {
        title: "这场面试没有被保存",
        description: "创建记录时就失败了（可能是配额或网络问题），所以评估无处可存。请重新开始一次面试。",
      };
}

/**
 * Copy for a write that threw. "Never saved" and "saved the row, failed the
 * write" need different sentences; the old one promised retained data in both
 * cases.
 */
export function persistenceFailureNotice(err: unknown): SettlementNotice {
  const message = err instanceof Error ? err.message : String(err);
  if (/not persistable|never saved/i.test(message)) {
    return {
      title: "这场面试没有被保存",
      description: "会话在写入数据库之前就失败了，所以没有可展示的评估。请重新开始一次面试。",
    };
  }
  return {
    title: "保存评估时出错",
    description: "评估已生成但没能写入。请稍后重试结束面试，或从控制台查看本场记录。",
  };
}
