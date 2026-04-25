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
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages, framework } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Missing or invalid messages" }, { status: 400 });
    }

    // Cost-aware routing: short interviews (few messages/characters) use glm-4-flash, long ones use glm-4.7-flash
    const transcriptLength = JSON.stringify(messages).length;
    const isComplex = messages.length > 8 || transcriptLength > 2000;
    const modelId = isComplex ? 'glm-4.7-flash' : 'glm-4-flash';
    console.log(`[Cost-Aware] Analyzing interview with ${modelId} (Messages: ${messages.length}, Chars: ${transcriptLength})`);

    const schema = z.object({
      councilDebate: z.object({
        technicalAdvisor: z.object({
          stance: z.enum(["strong_hire", "hire", "leaning_hire", "leaning_no_hire", "no_hire"]),
          reasoning: z.string(),
        }),
        hrAdvisor: z.object({
          stance: z.enum(["strong_hire", "hire", "leaning_hire", "leaning_no_hire", "no_hire"]),
          reasoning: z.string(),
        }),
        cultureFitAdvisor: z.object({
          stance: z.enum(["strong_hire", "hire", "leaning_hire", "leaning_no_hire", "no_hire"]),
          reasoning: z.string(),
        })
      }),
      radarScores: z.object({
        logic: z.number().min(0).max(100),
        expression: z.number().min(0).max(100),
        professionalism: z.number().min(0).max(100),
        confidence: z.number().min(0).max(100),
        pressure: z.number().min(0).max(100),
        systemDesign: z.number().min(0).max(100).optional(),
      }),
      qaReview: z.array(
        z.object({
          question: z.string(),
          userAnswer: z.string(),
          flaws: z.string(),
          perfectRewrite: z.string(),
        })
      ),
      hireVerdict: z.enum(["strong_hire", "hire", "leaning_hire", "leaning_no_hire", "no_hire"]),
      verdictRationale: z.string(),
      timelineEvents: z.array(
        z.object({
          id: z.string(),
          timestamp: z.number(),
          type: z.enum(["question", "answer", "feedback", "milestone", "warning"]),
          title: z.string(),
          description: z.string().optional(),
        })
      ).optional(),
      culturalTraits: z.array(
        z.object({
          trait: z.string(),
          score: z.number().min(0).max(100),
          evidence: z.string(),
        })
      ).optional(),
      trainingRoadmap: z.object({
        technical: z.array(z.string()),
        behavioral: z.array(z.string()),
        resources: z.array(z.string()),
      }).optional(),
    });

    const prompt = `You are an expert Hiring Committee evaluating an interview transcript. 
We are convening a "Hiring Council" composed of three distinct advisors:
1. Technical Advisor: Focuses strictly on logic, accuracy, problem-solving depth, and domain expertise.
2. HR Advisor: Focuses on expression, professionalism, communication clarity, and structural organization of answers.
3. Culture Fit Advisor: Focuses on confidence, pressure handling, adaptability, and alignment with modern professional values.

Analyze the transcript and provide:
1. councilDebate: For each of the three advisors, provide their independent stance and a 2-3 sentence reasoning based on their specific focus area.
2. radarScores: Consensus scores (0-100) for Logic, Expression, Professionalism, Confidence, Pressure Handling, and systemDesign (if applicable based on architectural discussions).
    3. qaReview: A list of the key questions asked by the AI (assistant), the user's corresponding answer, any flaws or areas of improvement in the user's answer, and a perfect, professional rewrite of how the user should have answered.${
      (framework === "star" || framework === "behavioral")
        ? " IMPORTANT: Since this is a Behavioral/STAR interview, explicitly evaluate whether the user's answer followed the STAR (Situation, Task, Action, Result) format. In the 'flaws' section, strictly breakdown which STAR components were present and which were missing (e.g. [S: ✔️] [T: ❌] [A: ✔️] [R: ❌]). Explicitly point out any missing components as a major flaw!"
        : ""
    }
4. hireVerdict: Provide a definitive final hiring decision based on the council's synthesized views.
5. verdictRationale: A detailed paragraph explaining the final hiring decision, explicitly mentioning how the council's debate converged (e.g., "While the Technical Advisor noted strong logic, HR raised concerns about expression...").
6. timelineEvents: A chronological list of 5-10 key moments. \`timestamp\` is relative ms from start (e.g., 0, 30000). \`type\` can be "question", "answer", "feedback", "milestone", or "warning".

9. culturalTraits: Provide an array of specific cultural/behavioral traits, their scores (0-100), and a short evidence quote/reasoning based on the interview context.${
      framework === "amazon_lps" 
        ? " Focus strictly on Amazon Leadership Principles (e.g., Customer Obsession, Ownership, Dive Deep, Bias for Action)." 
        : framework === "google_googliness" 
        ? " Focus strictly on Google Googliness traits (e.g., Thrive in Ambiguity, Do the right thing, Value Feedback)."
        : framework === "startup_scrappiness"
        ? " Focus strictly on Start-up Scrappiness traits (e.g., Bias for action, 0 to 1 builder, Extreme ownership)."
        : ""
    }
10. trainingRoadmap: Provide a personalized training roadmap based on the candidate's weaknesses detected during the interview. Include actionable 'technical' practices (e.g., 3 Leetcode patterns to practice), 'behavioral' communication exercises, and recommended 'resources' (books, links, courses).

Provide all textual analysis and reasoning in Chinese (except for the trait names if they are proprietary like 'Customer Obsession').

Transcript:
${JSON.stringify(messages, null, 2)}
`;

    try {
      const result = await generateObject({
        model: zhipu(modelId),
        abortSignal: req.signal,
        schema,
        prompt,
      });
      return NextResponse.json(result.object);
    } catch (primaryError) {
      console.warn(`Primary model ${modelId} failed, falling back to glm-4-flash`, primaryError);
      const fallbackResult = await generateObject({
        model: zhipu.chat("glm-4-flash"),
        abortSignal: req.signal,
        schema,
        prompt,
      });
      return NextResponse.json(fallbackResult.object);
    }
  } catch (error) {
    console.error("Error analyzing interview:", error);
    return NextResponse.json(
      { error: "Failed to analyze interview" },
      { status: 500 }
    );
  }
}
