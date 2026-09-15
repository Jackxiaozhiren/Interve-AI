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

  // Council Debate (legacy rows only — preserved history)
  if (interview.councilDebate) {
    lines.push("## Council Debate & Synthesis");
    if (interview.verdictRationale) {
      lines.push(`**Verdict Synthesis:** ${interview.verdictRationale}`);
      lines.push("");
    }
    
    const { technicalAdvisor, hrAdvisor, cultureFitAdvisor } = interview.councilDebate;
    
    if (technicalAdvisor) {
      lines.push("### Technical Advisor");
      lines.push(`**Stance:** ${technicalAdvisor.stance.replace(/_/g, " ")}`);
      lines.push(`**Reasoning:** ${technicalAdvisor.reasoning}`);
      lines.push("");
    }

    if (hrAdvisor) {
      lines.push("### HR Advisor");
      lines.push(`**Stance:** ${hrAdvisor.stance.replace(/_/g, " ")}`);
      lines.push(`**Reasoning:** ${hrAdvisor.reasoning}`);
      lines.push("");
    }

    if (cultureFitAdvisor) {
      lines.push("### Culture Fit Advisor");
      lines.push(`**Stance:** ${cultureFitAdvisor.stance.replace(/_/g, " ")}`);
      lines.push(`**Reasoning:** ${cultureFitAdvisor.reasoning}`);
      lines.push("");
    }
  }

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
