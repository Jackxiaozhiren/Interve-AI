import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

const zhipu = createOpenAI({
  // @ts-expect-error - compatibility flag needed for Zhipu AI provider
  compatibility: 'compatible',
  baseURL: process.env.OPENAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/",
  apiKey: process.env.ZHIPU_API_KEY,
});

// Config specific to this route
export const maxDuration = 60; // 60 seconds
export const runtime = 'edge';

interface AnalyzeChunkRequest {
  text: string;
  context?: string;
  role?: string;
  level?: string;
}

export async function POST(req: Request) {
  try {
    const { text, context, role, level } = (await req.json()) as AnalyzeChunkRequest;

    if (!text) {
      return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 });
    }

    const startTime = performance.now();
    const { object } = await generateObject({
      model: zhipu.chat("glm-4-flash"), // Fast model for real-time analysis
      system: `You are an expert ${level} ${role} technical interviewer. 
Analyze the provided transcript chunk from the candidate's answer in real-time. 
Assess the sentiment (confidence/positivity vs hesitation/nervousness) and technical accuracy based on the context.
Return numeric scores from 0 to 100 for both metrics. 
If the text is too short to accurately assess, provide your best guess or a neutral score (e.g., 70 for sentiment, 50 for accuracy).
Context of the interview: ${context || 'None provided'}`,
      schema: z.object({
        sentimentScore: z.number().describe("0 to 100. 100 is highly confident, positive, and fluent. 0 is extremely nervous, hesitant, or negative."),
        technicalAccuracy: z.number().describe("0 to 100. 100 is perfectly accurate and highly relevant to the context. 0 is completely wrong or irrelevant.")
      }),
      prompt: `Analyze this transcript chunk:\n"${text}"`,
    });
    const endTime = performance.now();
    console.log(`[Telemetry] analyze-chunk latency: ${Math.round(endTime - startTime)}ms`);

    return NextResponse.json(object);

  } catch (error: unknown) {
    console.error('Error analyzing chunk:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
