import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextResponse } from "next/server";

const zhipu = createOpenAI({
  // @ts-expect-error - compatibility flag needed for Zhipu AI provider
  compatibility: 'compatible',
  baseURL: process.env.OPENAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/",
  apiKey: process.env.ZHIPU_API_KEY,
});

export const runtime = 'edge';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { imageBase64, problemContext } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });
    }

    const { text } = await generateText({
      model: zhipu.chat("glm-4v-plus"), // Use the most capable vision model
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an expert Principal Engineer and System Architect interviewing a candidate.
The candidate has drawn the following system architecture diagram on the whiteboard.
${problemContext ? `The problem they are solving is: ${problemContext}\n` : ''}
Analyze this architecture diagram. Identify any single points of failure, scalability bottlenecks, security flaws, or missing components (e.g. load balancers, caching, message queues). 
Provide constructive, direct feedback (under 100 words) as if you were talking directly to the candidate in an interview. Point out exactly what they missed or what could be improved.`
            },
            {
              type: "image",
              image: new URL(imageBase64)
            }
          ]
        }
      ]
    });

    return NextResponse.json({ feedback: text });
  } catch (error) {
    console.error("Error analyzing architecture diagram:", error);
    return NextResponse.json(
      { error: "Failed to analyze architecture diagram" },
      { status: 500 }
    );
  }
}
