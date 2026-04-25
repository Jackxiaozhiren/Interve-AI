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

export async function POST(req: Request) {
  try {
    const { transcript } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
    }

    const { object } = await generateObject({
      model: zhipu.chat("glm-4-flash"), // Use flash model for fast analysis
      system: `You are an expert behavioral interview assessor. Analyze the candidate's transcript and assess their soft skills and behavioral traits.
Return a JSON object with scores from 0 to 100 for each component.
- leadership: Demonstrating ownership, guiding others, or driving projects.
- problemSolving: Breaking down complex issues, overcoming technical or business hurdles.
- communication: Clarity of thought, structured explanation, and collaboration.
Score each based on how explicitly and fully it was addressed. If completely missing, score 0.`,
      prompt: `Candidate's transcript:\n"""\n${transcript}\n"""\n\nPlease evaluate the behavioral traits.`,
      schema: z.object({
        leadership: z.number().min(0).max(100).describe("Score for Leadership"),
        problemSolving: z.number().min(0).max(100).describe("Score for Problem Solving"),
        communication: z.number().min(0).max(100).describe("Score for Communication")
      }),
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error analyzing behavioral traits:", error);
    return NextResponse.json(
      { error: "Failed to analyze behavioral traits" },
      { status: 500 }
    );
  }
}
