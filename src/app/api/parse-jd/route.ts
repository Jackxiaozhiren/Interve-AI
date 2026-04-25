import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const maxDuration = 60; // 60 seconds
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { jobDescription, questionCount = 5 } = await req.json();

    if (!jobDescription) {
      return NextResponse.json({ error: 'Missing jobDescription parameter' }, { status: 400 });
    }

    const { object } = await generateObject({
      model: google('models/gemini-2.5-flash'),
      system: `You are an expert technical recruiter and senior engineering manager.
Your task is to analyze a provided Job Description (JD) and generate a custom bank of interview questions tailored to the role's requirements.
Generate exactly ${questionCount} high-quality questions. Mix technical, behavioral, and architectural questions based on what the JD demands.
For each question, provide:
1. The question text.
2. The rationale for asking this question (why it matters for this specific JD).
3. A list of expected skills or keywords you'd want the candidate to mention in a strong answer.`,
      schema: z.object({
        title: z.string().describe("A concise, derived title for this assessment based on the JD (e.g., 'Senior Frontend Engineer Assessment')"),
        questions: z.array(z.object({
          question: z.string().describe("The interview question text"),
          rationale: z.string().describe("Why this question is relevant to the JD"),
          expectedSkills: z.array(z.string()).describe("List of keywords or skills to listen for in a good answer")
        }))
      }),
      prompt: `Parse the following Job Description and generate interview questions:\n\n${jobDescription}`,
    });

    return NextResponse.json(object);

  } catch (error: unknown) {
    console.error('Error parsing JD:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
