import Link from "next/link";
import { getAllQuestions } from "@/lib/question-bank";
import { notFound } from "next/navigation";
import PracticeSessionClient from "./client";

export function generateStaticParams() {
  const questions = getAllQuestions();
  return questions.map((q) => ({
    id: q.id,
  }));
}

export default async function PracticeSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const questions = getAllQuestions();
  const question = questions.find(q => q.id === resolvedParams.id);

  if (!question) {
    notFound();
  }

  return (
    <>
      {/* S3: detail pages need a route back to the question bank. */}
      <Link href="/practice" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm">
        返回题库
      </Link>
      <PracticeSessionClient key={question.id} question={question} />
    </>
  );
}
