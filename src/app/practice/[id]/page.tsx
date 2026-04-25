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

  return <PracticeSessionClient question={question} />;
}
