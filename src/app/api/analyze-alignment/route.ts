import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Use edge runtime for faster execution
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { resumeText, jobDescription } = await req.json();

    if (!resumeText || !jobDescription) {
      return NextResponse.json(
        { error: 'Missing resumeText or jobDescription' },
        { status: 400 }
      );
    }

    const startTime = performance.now();
    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: z.object({
        matchScore: z.number().min(0).max(100).describe("The overall match score (0-100) based on how well the candidate's skills and experience fit the job description."),
        strengths: z.array(z.string()).describe("A list of 3-5 key strengths or aligned skills the candidate possesses."),
        gaps: z.array(z.string()).describe("A list of 2-4 skill gaps or missing requirements."),
        recommendedFocus: z.string().describe("A concise instruction (max 2 sentences) for the AI interviewer on what topics to drill into based on the candidate's gaps and strengths.")
      }),
      prompt: `You are an expert technical recruiter and AI interviewer.
Analyze the following candidate's resume against the provided Job Description (JD) / Context.
Your goal is to determine how well the candidate fits the role, identify their key strengths, pinpoint any missing skills or gaps, and provide a recommended focus for the upcoming technical interview to probe those gaps.

RESUME:
${resumeText}

JOB DESCRIPTION / CONTEXT:
${jobDescription}

Provide a realistic, objective assessment. Be strict but fair.`
    });
    const endTime = performance.now();
    console.log(`[Telemetry] analyze-alignment latency: ${Math.round(endTime - startTime)}ms`);

    return NextResponse.json(object);
  } catch (error) {
    console.error('Failed to analyze alignment:', error);
    return NextResponse.json(
      { error: 'Failed to analyze alignment' },
      { status: 500 }
    );
  }
}
