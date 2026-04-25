import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { z } from "zod";

const zhipu = createOpenAI({
  // @ts-expect-error - compatibility flag needed for Zhipu AI provider
  compatibility: 'compatible',
  baseURL: process.env.OPENAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/",
  apiKey: process.env.ZHIPU_API_KEY,
  fetch: async (url, options) => {
    if (options?.body) {
      const body = JSON.parse(options.body as string);
      if (body.model === 'glm-4.7-flash') {
        body.thinking = { type: 'enabled' };
        body.max_tokens = 65536;
      }
      options.body = JSON.stringify(body);
    }
    return fetch(url, options);
  }
});

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { resumeText, jobDescription } = await req.json();

    if (!jobDescription) {
      return NextResponse.json({ error: "Missing job description" }, { status: 400 });
    }

    // Cost-aware routing
    const textLength = (resumeText?.length || 0) + jobDescription.length;
    const modelId = textLength > 2000 ? 'glm-4.7-flash' : 'glm-4-flash';
    console.log(`[Cost-Aware] Analyzing match with ${modelId} (Chars: ${textLength})`);

    const result = await generateObject({
      model: zhipu(modelId),
      schema: z.object({
        overallScore: z.number().min(0).max(100),
        alignedSkills: z.array(z.string()),
        missingSkills: z.array(z.string()),
        recommendations: z.array(z.string()),
      }),
      prompt: `You are an expert technical recruiter and hiring manager.
Your task is to analyze the gap between a candidate's resume and a job description.

Job Description:
${jobDescription}

Candidate Resume:
${resumeText || 'No resume provided. Candidate may just be doing a general mock interview.'}

Please extract the following structured information:
1. overallScore: A match score from 0 to 100 representing how well the resume aligns with the JD. If no resume is provided, score it based on general baseline or 0.
2. alignedSkills: A list of 3-7 skills or requirements from the JD that the candidate clearly possesses.
3. missingSkills: A list of 3-7 skills or requirements from the JD that the candidate lacks or hasn't explicitly mentioned.
4. recommendations: A list of 2-4 actionable recommendations for the candidate to improve their fit or address the missing skills during an interview.

Provide your analysis in Chinese.
`,
    });

    return NextResponse.json({ matchData: result.object });
  } catch (error) {
    console.error("Error analyzing match:", error);
    return NextResponse.json(
      { error: "Failed to analyze match" },
      { status: 500 }
    );
  }
}
