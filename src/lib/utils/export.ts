import { Interview } from "@/lib/db";

export function exportInterviewToMarkdown(interview: Interview): string {
  const lines: string[] = [];
  const dateStr = new Date(interview.createdAt).toLocaleString();

  // Header
  lines.push(`# Interview Report: ${interview.title}`);
  lines.push(`**Date:** ${dateStr}`);
  lines.push(`**Title:** ${interview.title || "General Interview"}`);
  lines.push(`**Overall Readiness Score:** ${interview.matchData?.overallScore !== undefined ? interview.matchData.overallScore + "/100" : "N/A"}`);
  lines.push("");

  // Cultural Traits
  if (interview.culturalTraits && interview.culturalTraits.length > 0) {
    lines.push("## Cultural & Behavioral Traits");
    interview.culturalTraits.forEach(trait => {
      lines.push(`- **${trait.trait}** (${trait.score}/100)`);
      lines.push(`  *Evidence:* ${trait.evidence}`);
    });
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

  // Council Debate
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
