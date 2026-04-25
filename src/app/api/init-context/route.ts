import { createOpenAI } from '@ai-sdk/openai';
import { streamObject } from 'ai';
import { z } from 'zod';

// Ensure standard Edge runtime for fast response
export const runtime = 'edge';

// We initialize the custom Zhipu AI provider
const zhipu = createOpenAI({
  // @ts-expect-error - compatibility flag needed for Zhipu AI provider
  compatibility: 'compatible',
  baseURL: process.env.OPENAI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/',
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

const InitContextSchema = z.object({
  cheatsheet: z.array(z.string()).describe('List of 5-7 bullet points summarizing key requirements and qualifications from the JD matched against the resume.'),
  topPredictions: z.array(
    z.object({
      question: z.string().describe('Predicted interview question based on JD and Resume'),
      rationale: z.string().describe('Why this question is likely to be asked'),
      keyPointsToHit: z.array(z.string()).describe('Key points the candidate should cover in the answer'),
    })
  ).length(5).describe('Top 5 most likely interview questions'),
});

export async function POST(req: Request) {
  try {
    const { jobDescription, resumeContext } = await req.json();

    if (!jobDescription || !resumeContext) {
      return new Response('Missing jobDescription or resumeContext', { status: 400 });
    }

    const systemPrompt = `
You are an expert technical interviewer and HR career coach. Your task is to analyze the provided Job Description (JD) and the candidate's Resume context, then generate:
1. A concise cheatsheet of key requirements matched with the candidate's experience.
2. Top 5 predicted interview questions with rationale and key points to hit. Ensure a mix of technical and Behavioral/HR questions.

Follow these rules:
- Be highly specific to the provided JD and Resume.
- The cheatsheet should highlight strengths and potential gap areas.
- For behavioral questions, structure the \`keyPointsToHit\` using the STAR method (Situation, Task, Action, Result).
- Keep the output extremely focused and professional.
- Your output must perfectly match the requested JSON schema.
- Language: Please generate all content in Chinese (zh-CN), as requested by the user.
    `;

    const userPrompt = `
### Job Description:
${jobDescription}

### Resume Context:
${resumeContext}
    `;

    // Cost-aware routing: determine complexity by input length
    const totalLength = jobDescription.length + resumeContext.length;
    const isComplex = totalLength > 2500;
    const modelId = isComplex ? 'glm-4.7-flash' : 'glm-4-flash';
    console.log(`[Cost-Aware] Routing to ${modelId} based on context length (${totalLength} chars)`);

    const result = await streamObject({
      model: zhipu(modelId),
      schema: InitContextSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 1.0,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate context' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
