import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";

const zhipu = createOpenAI({
  // @ts-expect-error - compatibility flag needed for Zhipu AI provider
  compatibility: 'compatible',
  baseURL: process.env.OPENAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/",
  apiKey: process.env.ZHIPU_API_KEY,
});

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { problemTitle, problemDescription, currentCode, chatHistory } = await req.json();

    const systemPrompt = `You are a supportive technical interview AI Co-pilot. 
The candidate is currently solving the following problem:
Title: ${problemTitle}
Description: ${problemDescription}

Their current code is:
\`\`\`
${currentCode}
\`\`\`

The candidate is asking for a hint. Your goal is to provide a brief, pedagogical hint that helps them get unstuck without giving away the direct solution. 
Point out a potential issue in their logic or suggest a concept they should consider (e.g., "Have you considered using a hash map to reduce the time complexity?" or "Look closely at your loop termination condition").
Keep your response under 3 sentences. Be encouraging.`;

    const result = await generateText({
      model: zhipu.chat('glm-4-flash'),
      system: systemPrompt,
      prompt: `Chat history:\n${chatHistory}\n\nPlease give me a hint.`
    });

    return NextResponse.json({ hint: result.text });
  } catch (error: unknown) {
    console.error("Hint Generation Error:", error);
    return NextResponse.json(
      { error: "Failed to generate hint" },
      { status: 500 }
    );
  }
}
