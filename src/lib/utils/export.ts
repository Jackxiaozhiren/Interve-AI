import { Interview } from "@/lib/db";
import { toEvaluationView } from "@/lib/eval-compat";
import { READINESS_DISCLAIMER } from "@/ai/evaluation-contract";

export function exportInterviewToMarkdown(interview: Interview): string {
  const lines: string[] = [];
  const dateStr = new Date(interview.createdAt).toLocaleString();
  // Phase 4: readiness + evidence-grounded dimensions replace hire verdicts
  // and the hiring council. Legacy rows export with an explicit caveat.
  const view = toEvaluationView(interview);

  // Header
  lines.push(`# Interview Report: ${interview.title}`);
  lines.push(`**Date:** ${dateStr}`);
  lines.push(`**Title:** ${interview.title || "General Interview"}`);
  lines.push(`**Overall Readiness Score:** ${view.average !== null ? view.average + "/100" : "N/A"}`);
  lines.push("");

  // Phase 4: the candidate's first question is "what do I do next", so the
  // roadmap is the first section after the header — above the rubric, the
  // scores and the transcript. Legacy rows keep it at the top level, V2 rows
  // inside evaluationV2; the fallback matches the report page.
  const roadmap = interview.trainingRoadmap ?? interview.evaluationV2?.trainingRoadmap;
  if (roadmap) {
    lines.push("## 下一步练什么");
    const roadmapSection = (title: string, items: string[]) => {
      if (items.length === 0) return;
      lines.push(`### ${title}`);
      items.forEach((item) => lines.push(`- ${item}`));
      lines.push("");
    };
    roadmapSection("技术重点", roadmap.technical);
    roadmapSection("行为与表达", roadmap.behavioral);
    roadmapSection("推荐资源", roadmap.resources);
  }

  // Readiness
  lines.push(`## Interview Readiness${view.legacy ? " (Legacy Assessment)" : ""}`);
  lines.push(`**Level:** ${view.readinessLabel ?? "Pending"}`);
  if (view.readinessRationale) {
    lines.push(`**Rationale:** ${view.readinessRationale}`);
  }
  if (!view.legacy) {
    lines.push(`*${READINESS_DISCLAIMER}*`);
  } else if (view.disclaimer) {
    lines.push(`*${view.disclaimer}*`);
  }
  lines.push("");

  // Dimensions with evidence
  if (view.dimensions.length > 0) {
    lines.push("## Rubric Dimensions");
    view.dimensions.forEach(dim => {
      lines.push(`- **${dim.name}** (${dim.score100}/100, ${dim.confidence} confidence${dim.anchorLevel !== null ? `, anchor L${dim.anchorLevel}/5` : ""})`);
      lines.push(`  *Rationale:* ${dim.rationale}`);
      dim.evidence.forEach(q => lines.push(`  *Evidence:* "${q}"`));
      lines.push(`  *Next drill:* ${dim.improvement}`);
    });
    lines.push("");
  }

  // Strengths / gaps / drills (V2)
  if (view.strengths.length > 0 || view.weaknesses.length > 0 || view.nextDrills.length > 0) {
    lines.push("## Summary & Next Drills");
    view.strengths.forEach(s => lines.push(`- Strength: ${s}`));
    view.weaknesses.forEach(s => lines.push(`- Gap: ${s}`));
    view.nextDrills.forEach(s => lines.push(`- Drill: ${s}`));
    lines.push("");
  }

  // QA Review & Diagnostics
  if (interview.qaReview && interview.qaReview.length > 0) {
    lines.push("## Diagnostic Review");
    interview.qaReview.forEach((qa, index) => {
      lines.push(`### QA Pair ${index + 1}`);
      lines.push(`**Question:** ${qa.question}`);
      lines.push(`**Your Answer:** ${qa.userAnswer}`);
      lines.push(`**Flaws:** ${qa.flaws}`);
      lines.push(`**Target Response:** ${qa.perfectRewrite}`);
      lines.push("");
    });
  }

  // Council Debate was removed here, not preserved. It rendered an advisor "stance"
  // — a hire verdict with a different label — next to a quoted justification, which
  // is exactly what N2 forbids the product from saying about a person. The old
  // comment called it "preserved history"; it was exported to a file the candidate
  // could be shown, or a recruiter could forward. Rows predating the removal are
  // still in the table; they are simply no longer turned into a document.
  // Full Transcript
  if (interview.transcript && interview.transcript.length > 0) {
    lines.push("## Full Transcript");
    interview.transcript.forEach((msg) => {
      const roleName = msg.role === "user" ? "Candidate" : "Interve AI";
      lines.push(`**${roleName}:**`);
      lines.push(`${msg.content}`);
      lines.push("");
    });
  }

  return lines.join("\n");
}

export function downloadFile(content: string, filename: string, type: string = "text/markdown") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
