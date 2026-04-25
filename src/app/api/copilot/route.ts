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
    const { question, resumeSnippets, model } = await req.json();

    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    let selectedModel;
    if (model === 'openai') {
      const { createOpenAI: createOpenAIOfficial } = await import('@ai-sdk/openai');
      const openai = createOpenAIOfficial({ apiKey: process.env.OPENAI_API_KEY });
      selectedModel = openai.chat('gpt-4o-mini');
    } else if (model === 'gemini') {
      const { google } = await import('@ai-sdk/google');
      selectedModel = google('models/gemini-1.5-flash');
    } else {
      selectedModel = zhipu.chat('glm-4-flash');
    }

    const systemPrompt = `You are an AI Interview Copilot. Your job is to help the candidate answer the interviewer's question using their own resume experience.
The interviewer just asked: "${question}"

Here are relevant snippets from the candidate's resume:
${(resumeSnippets || []).join("\n---\n")}

Provide 2-3 extremely concise bullet points (max 15 words each) to remind the candidate what to talk about based ONLY on these snippets. 
Do not invent experiences. If the snippets don't help, suggest a generic behavioral framework for the question.
Please return the result ONLY as a JSON array of strings, for example: ["Hint 1", "Hint 2"]. Do not include markdown code blocks or any other text.`;

    const result = await generateText({
      model: selectedModel,
      system: systemPrompt,
      prompt: "Generate the JSON array of hints."
    });

    let hints: string[] = [];
    try {
      let text = result.text.trim();
      if (text.startsWith("```")) {
        text = text.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
      }
      hints = JSON.parse(text);
      if (!Array.isArray(hints)) {
        hints = [String(hints)];
      }
    } catch {
      console.warn("Failed to parse JSON, falling back to line split:", result.text);
      hints = result.text.split('\n').filter(l => l.trim().length > 0).map(l => l.replace(/^[-*•]\s*/, '').replace(/^"|"$/g, ''));
    }

    return NextResponse.json({ hints });
  } catch (error: unknown) {
    console.error("Copilot Generation Error:", error);
    return NextResponse.json(
      { error: "Failed to generate copilot hints" },
      { status: 500 }
    );
  }
}
