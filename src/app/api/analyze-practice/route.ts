import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const maxDuration = 60;
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { question, answer } = await req.json();

    if (!question || !answer) {
      return NextResponse.json({ error: 'Missing question or answer' }, { status: 400 });
    }

    const { object } = await generateObject({
      model: google('models/gemini-2.5-flash'), // Fast model
      system: `You are an expert technical interviewer. Evaluate the candidate's answer to the given interview question.
Provide a numeric score (0-100), a list of strengths (1-3 short bullet points), and a list of areas for improvement (1-3 short bullet points).
Be objective and constructive.`,
      schema: z.object({
        score: z.number().min(0).max(100).describe("Overall quality score of the answer from 0 to 100."),
        strengths: z.array(z.string()).describe("List of strengths in the candidate's answer."),
        improvements: z.array(z.string()).describe("List of actionable improvements for the candidate's answer.")
      }),
      prompt: `Question: ${question.title}\nDescription: ${question.description}\nCategory: ${question.category}\n\nCandidate's Answer:\n"${answer}"`,
    });

    return NextResponse.json(object);

  } catch (error: unknown) {
    console.error('Error analyzing practice answer:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
