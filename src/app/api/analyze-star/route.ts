import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";

const zhipu = createOpenAI({
  // @ts-expect-error - compatibility flag needed for Zhipu AI provider
  compatibility: 'compatible',
  baseURL: process.env.OPENAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/",
  apiKey: process.env.ZHIPU_API_KEY,
});

export const runtime = 'edge';
export const maxDuration = 30;

interface AnalyzeStarRequest {
  transcript: string;
  codeContext?: string;
  systemDesignContext?: string;
}

export async function POST(req: Request) {
  try {
    const { transcript, codeContext, systemDesignContext } = (await req.json()) as AnalyzeStarRequest;

    if (!transcript) {
      return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
    }

    const { object } = await generateObject({
      model: zhipu.chat("glm-4-flash"), // Use flash model for fast analysis
      system: `You are an expert behavioral interview assessor. Analyze the candidate's transcript and assess how completely they have covered the STAR framework (Situation, Task, Action, Result).
Return a JSON object with scores from 0 to 100 for each component, along with a confidence score (0-100) and an estimated time spent (in seconds) on that component based on the transcript length.
- Situation: Context, background, or constraints.
- Task: The candidate's specific role, objective, or responsibility.
- Action: The specific steps, technical decisions, or actions the candidate took.
- Result: The quantifiable outcome, business impact, or lesson learned.
Score each based on how explicitly and fully it was addressed. If completely missing, score 0.
IMPORTANT: The candidate may also be writing code or drawing a system design simultaneously.
If there is non-empty code or system design provided, YOU MUST treat it as undeniable evidence of "Action" (A). Consequently, the Action score MUST be evaluated to at least 40 even if they didn't explicitly describe the actions in the transcript. Furthermore, evaluate the complexity of the provided code or system design to proportionally increase both Action (A) and Result (R) scores, up to 100 if the implementation is complete and functional.`,
      prompt: `Candidate's transcript:\n"""\n${transcript}\n"""\n\nCode Context (if any):\n"""\n${codeContext || 'None'}\n"""\n\nSystem Design Context (if any):\n"""\n${systemDesignContext || 'None'}\n"""\n\nPlease evaluate the STAR components.`,
      schema: z.object({
        s: z.object({
          progress: z.number().min(0).max(100).describe("Score for Situation"),
          confidence: z.number().min(0).max(100).describe("Confidence in this assessment"),
          timeSpentSeconds: z.number().min(0).describe("Estimated time spent in seconds")
        }),
        t: z.object({
          progress: z.number().min(0).max(100).describe("Score for Task"),
          confidence: z.number().min(0).max(100).describe("Confidence in this assessment"),
          timeSpentSeconds: z.number().min(0).describe("Estimated time spent in seconds")
        }),
        a: z.object({
          progress: z.number().min(0).max(100).describe("Score for Action"),
          confidence: z.number().min(0).max(100).describe("Confidence in this assessment"),
          timeSpentSeconds: z.number().min(0).describe("Estimated time spent in seconds")
        }),
        r: z.object({
          progress: z.number().min(0).max(100).describe("Score for Result"),
          confidence: z.number().min(0).max(100).describe("Confidence in this assessment"),
          timeSpentSeconds: z.number().min(0).describe("Estimated time spent in seconds")
        })
      }),
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error analyzing STAR progress:", error);
    return NextResponse.json(
      { error: "Failed to analyze STAR progress" },
      { status: 500 }
    );
  }
}
