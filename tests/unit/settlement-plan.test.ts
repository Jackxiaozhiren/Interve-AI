import { describe, expect, it } from "vitest";
import {
  analysisFailureNotice,
  persistenceFailureNotice,
  planSettlement,
  unsavedNotice,
} from "@/lib/interview/settlement-plan";

/**
 * Ending an interview makes three decisions that used to be spread across an
 * effect, a fetch, a throw and a hard navigation, and every one of them was
 * wrong in the same direction: the user was told something had been kept when
 * it had not.
 *
 * The failure this encodes, traced end to end: setup hands the room
 * `id=local-<uuid>` whenever its insert failed. Settlement then (1) called
 * /api/analyze-interview anyway, spending a provider call on an evaluation it
 * could not store, (2) threw inside db.interviews.update(), whose own message
 * says "this session was never saved to the database", (3) showed "生成报告时出错
 * / 我们将保留部分数据" — a promise nothing backed — and (4) navigated to
 * /dashboard/report/local-<uuid>, a page whose read is guarded by the same
 * id rule and therefore renders empty.
 */
describe("planSettlement", () => {
  it("analyzes and reports when the session has a real row", () => {
    expect(planSettlement({ hasMessages: true, interviewId: "42" })).toEqual({
      shouldAnalyze: true,
      destination: "report",
      unsavedReason: null,
    });
  });

  it("does not spend an evaluation on an id that cannot hold it", () => {
    const plan = planSettlement({ hasMessages: true, interviewId: "local-6f1c2b3d" });
    expect(plan.shouldAnalyze).toBe(false);
    expect(plan.unsavedReason).toBe("not_persistable");
  });

  it("never routes to a report page that cannot resolve", () => {
    for (const id of ["local-6f1c2b3d", "", null]) {
      const plan = planSettlement({ hasMessages: true, interviewId: id });
      expect(plan.destination, `id=${String(id)}`).toBe("dashboard");
    }
  });

  it("names the reason only when something was actually lost", () => {
    expect(planSettlement({ hasMessages: false, interviewId: "local-x" }).unsavedReason).toBeNull();
    expect(planSettlement({ hasMessages: true, interviewId: null }).unsavedReason).toBe("no_id");
  });

  it("still opens the report when the row exists but nothing was said", () => {
    // The interview was created at setup; an abandoned session is viewable,
    // just unevaluated.
    expect(planSettlement({ hasMessages: false, interviewId: "42" })).toMatchObject({
      shouldAnalyze: false,
      destination: "report",
    });
  });
});

describe("analysisFailureNotice", () => {
  it("says nothing when the evaluation arrived", () => {
    expect(analysisFailureNotice({ ok: true, status: 200 })).toBeNull();
  });

  it("keeps the thin-transcript guidance distinct from a failure", () => {
    expect(analysisFailureNotice({ ok: false, status: 422 })).toMatchObject({
      title: "回答内容较薄，暂无法生成完整评估",
    });
    expect(analysisFailureNotice({ ok: false, status: 500, code: "THIN_TRANSCRIPT" })).toMatchObject({
      title: "回答内容较薄，暂无法生成完整评估",
    });
  });

  it("carries the status for every other failure — silence was the old bug", () => {
    const notice = analysisFailureNotice({ ok: false, status: 504, message: "Failed to analyze interview" });
    expect(notice).not.toBeNull();
    expect(notice!.description).toContain("504");
    expect(notice!.description).toContain("Failed to analyze interview");
  });

  it("does not promise a report that will not be there", () => {
    const notice = analysisFailureNotice({ ok: false, status: 500 });
    expect(notice!.description).not.toMatch(/保留|已保存/);
  });
});

describe("unsavedNotice", () => {
  it("explains the two ways a session ends up unstored, without blaming the report", () => {
    expect(unsavedNotice("no_id").title).toBe("这场面试没有关联到记录");
    expect(unsavedNotice("not_persistable").title).toBe("这场面试没有被保存");
    for (const notice of [unsavedNotice("no_id"), unsavedNotice("not_persistable")]) {
      expect(notice.description).not.toMatch(/保留部分数据/);
    }
  });
});

describe("persistenceFailureNotice", () => {
  it("distinguishes 'never stored' from 'stored but the write failed'", () => {
    const neverSaved = persistenceFailureNotice(
      new Error('interview id "local-x" is not persistable: this session was never saved to the database')
    );
    expect(neverSaved.title).toBe("这场面试没有被保存");
    expect(neverSaved.description).not.toMatch(/保留部分数据/);

    const writeFailed = persistenceFailureNotice(new Error("could not connect to stream: Service Unavailable"));
    expect(writeFailed.title).toBe("保存评估时出错");
  });

  it("survives a thrown non-Error", () => {
    expect(persistenceFailureNotice("boom").title).toBe("保存评估时出错");
  });
});
