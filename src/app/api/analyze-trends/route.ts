import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { Interview } from "@/lib/db";

// Configure Zhipu AI
const zhipu = createOpenAI({
  // @ts-expect-error - compatibility flag needed for Zhipu AI provider
  compatibility: 'compatible',
  baseURL: "https://open.bigmodel.cn/api/paas/v4/",
  apiKey: process.env.ZHIPU_API_KEY || "",
});

export const runtime = "edge";

const fallbackData = {
  recurringFlaws: ["Need more data to identify patterns"],
  keyStrengths: ["Need more data to identify strengths"],
  growthActionPlan: "Complete more interviews to generate a personalized trend analysis."
};

export async function POST(req: Request) {
  const startTime = performance.now();
  try {
    const { sessions } = await req.json();

    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      return new Response(JSON.stringify({
        recurringFlaws: [],
        keyStrengths: [],
        growthActionPlan: "Complete your first interview to unlock trend analysis and personalized growth plans."
      }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "X-Response-Time": `${(performance.now() - startTime).toFixed(2)}ms`
        },
      });
    }

    // Extract minimal data to save context window
    const sessionData = (sessions as Interview[]).map((s, index: number) => {
      return {
        sessionIndex: index + 1,
        title: s.title,
        verdict: s.hireVerdict,
        flaws: s.qaReview?.map((qa) => qa.flaws).filter(Boolean) || [],
        councilReasoning: s.councilDebate ? [
          s.councilDebate.technicalAdvisor?.reasoning,
          s.councilDebate.hrAdvisor?.reasoning,
          s.councilDebate.cultureFitAdvisor?.reasoning,
        ] : []
      };
    });

    try {
      const result = await generateText({
        model: zhipu.chat("glm-4-flash"),
        prompt: `You are an expert Talent Acquisition Director and Executive Coach.
        
I am providing you with the data from the candidate's last ${sessions.length} interview sessions.
Analyze their progression, specifically looking for recurring flaws across multiple sessions, and consistent strengths.

Session Data:
${JSON.stringify(sessionData, null, 2)}

Provide a concise, highly professional analysis. Make the tone encouraging but strictly analytical.

You MUST output your response as valid JSON matching this schema exactly, and nothing else (do not wrap in markdown blocks):
{
  "recurringFlaws": ["list", "of", "2-3", "flaws"],
  "keyStrengths": ["list", "of", "2-3", "strengths"],
  "growthActionPlan": "A 1-2 sentence actionable plan for the candidate to focus on in their next mock interview."
}`,
      });

      // Try to parse the text as JSON, sometimes LLMs add markdown wrapping
      let jsonText = result.text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7, -3).trim();
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3, -3).trim();
      }

      const parsedData = JSON.parse(jsonText);

      const endTime = performance.now();
      const latency = (endTime - startTime).toFixed(2);
      console.log(`[Performance] AI Trend Analysis took ${latency}ms`);

      return new Response(JSON.stringify({
        recurringFlaws: Array.isArray(parsedData.recurringFlaws) ? parsedData.recurringFlaws : fallbackData.recurringFlaws,
        keyStrengths: Array.isArray(parsedData.keyStrengths) ? parsedData.keyStrengths : fallbackData.keyStrengths,
        growthActionPlan: typeof parsedData.growthActionPlan === 'string' ? parsedData.growthActionPlan : fallbackData.growthActionPlan
      }), {
        headers: { 
          "Content-Type": "application/json",
          "X-Response-Time": `${latency}ms`
        },
      });
      
    } catch (generationError) {
      console.warn("AI generation or parsing failed, using fallback:", generationError);
      return new Response(JSON.stringify(fallbackData), {
        headers: { 
          "Content-Type": "application/json",
          "X-Response-Time": `${(performance.now() - startTime).toFixed(2)}ms`
        },
      });
    }

  } catch (error) {
    console.error("Trend Analysis Request Error:", error);
    return new Response(JSON.stringify(fallbackData), { 
      status: 200, 
      headers: { 
        "Content-Type": "application/json",
        "X-Response-Time": `${(performance.now() - startTime).toFixed(2)}ms`
      } 
    });
  }
}
