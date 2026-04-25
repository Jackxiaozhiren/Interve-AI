import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const AnalyzeCodeSchema = z.object({
  timeComplexity: z.string().describe("The time complexity of the code, e.g., O(n), O(n^2)."),
  spaceComplexity: z.string().describe("The space complexity of the code, e.g., O(1), O(n)."),
  issues: z.array(z.string()).describe("Any critical bugs or logic issues in the code."),
  hints: z.array(z.string()).describe("Hints for how to optimize the complexity or improve the code."),
  isOptimal: z.boolean().describe("Whether the code is optimal for typical technical interviews.")
});

export const runtime = 'edge';

interface AnalyzeCodeRequest {
  code: string;
  language?: string;
  problemStatement?: string;
}

export async function POST(req: Request) {
  try {
    const { code, language, problemStatement } = (await req.json()) as AnalyzeCodeRequest;

    if (!code || code.trim().length === 0) {
      return NextResponse.json({
        timeComplexity: "O(1)",
        spaceComplexity: "O(1)",
        issues: [],
        hints: ["Start writing code to get real-time feedback."],
        isOptimal: false
      });
    }

    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: AnalyzeCodeSchema,
      prompt: `You are an expert technical interviewer. Analyze the following ${language || 'code'} snippet.
      
      Problem Statement: ${problemStatement || 'Not provided'}
      
      Code:
      \`\`\`
      ${code}
      \`\`\`
      
      Analyze the time and space complexity. Identify any bugs, logic flaws, or inefficient loops. Provide hints for optimization. Be strict but constructive.`,
      temperature: 0.1, // Added for faster, deterministic output with lower latency
    });

    return NextResponse.json(object, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error analyzing code:", error);
    return NextResponse.json(
      { error: "Failed to analyze code." },
      { status: 500 }
    );
  }
}
