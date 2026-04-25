"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Database, Books, Sparkle, FileText, Briefcase, Plus, ArrowRight } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useInterveStore } from "@/store/useInterveStore";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function KnowledgePage() {
  const { resumeText, jobDescription, topPredictions } = useInterveStore();

  const hasData = resumeText.trim().length > 0 || jobDescription.trim().length > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif text-slate-900 tracking-tight">Knowledge Base</h1>
          <p className="text-slate-500 mt-2">Manage your uploaded resumes, technical context, and parsed documents.</p>
        </div>
        {hasData && (
          <Link href="/">
            <Button variant="outline" className="gap-2 rounded-xl border-slate-200">
              <Plus className="w-4 h-4" /> New Context
            </Button>
          </Link>
        )}
      </div>

      {!hasData ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="bg-white/60 border border-white/80 shadow-sm backdrop-blur-xl min-h-[400px] flex flex-col items-center justify-center text-center rounded-[24px]">
            <CardContent className="pt-6">
              <div className="w-20 h-20 rounded-3xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-6 mx-auto shadow-sm">
                <Database className="w-10 h-10 text-sky-400" weight="duotone" />
              </div>
              <h2 className="text-xl font-serif text-slate-800 mb-2">Your Knowledge Hub is empty</h2>
              <p className="text-slate-500 font-medium max-w-[320px] mx-auto leading-relaxed mb-8">
                Upload your documents from the homepage to start building your personalized interview context.
              </p>
              
              <Link href="/">
                <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-2 rounded-xl h-11 px-6 shadow-sm">
                  Go to Upload <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>

              <div className="mt-8 flex items-center justify-center gap-4 text-sm font-semibold text-slate-400">
                <span className="flex items-center gap-1.5"><Books className="w-4 h-4" /> Resumes</span>
                <span className="flex items-center gap-1.5"><Sparkle className="w-4 h-4" /> Extracted Skills</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="h-full bg-white/60 backdrop-blur-xl border-white/80 shadow-sm overflow-hidden rounded-[24px]">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg text-slate-800 font-serif">
                  <FileText className="w-5 h-5 text-sky-500" />
                  Resume Context
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="text-sm text-slate-600 bg-white p-5 rounded-xl border border-slate-100 max-h-[300px] overflow-y-auto whitespace-pre-wrap font-mono text-xs shadow-inner">
                  {resumeText || "No resume uploaded."}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Card className="h-full bg-white/60 backdrop-blur-xl border-white/80 shadow-sm overflow-hidden rounded-[24px]">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg text-slate-800 font-serif">
                  <Briefcase className="w-5 h-5 text-indigo-500" />
                  Job Description
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="text-sm text-slate-600 bg-white p-5 rounded-xl border border-slate-100 max-h-[300px] overflow-y-auto whitespace-pre-wrap font-mono text-xs shadow-inner">
                  {jobDescription || "No job description provided."}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {topPredictions && topPredictions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="md:col-span-2">
              <Card className="bg-white/60 backdrop-blur-xl border-white/80 shadow-sm overflow-hidden rounded-[24px]">
                <CardHeader className="bg-sky-50/30 border-b border-sky-100/50 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg text-slate-800 font-serif">
                    <Sparkle className="w-5 h-5 text-sky-500" weight="fill" />
                    AI Extracted Insights
                  </CardTitle>
                  <CardDescription>Targeted questions and rationales based on your context</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    {topPredictions.map((pred, idx) => (
                      <div key={idx} className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <h4 className="font-semibold text-slate-800 mb-2 leading-tight">{pred.question}</h4>
                        <p className="text-sm text-slate-500 mb-4 leading-relaxed">{pred.rationale}</p>
                        <div className="flex flex-wrap gap-2 mt-auto">
                          {pred.keyPointsToHit.map((point, pIdx) => (
                            <span key={pIdx} className="px-2.5 py-1 bg-sky-50 text-sky-700 rounded-lg text-[11px] font-medium border border-sky-100/50">
                              {point}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
