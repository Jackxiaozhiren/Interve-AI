"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Compass, Target, Layers, Play } from "lucide-react";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InterviewQuestion, searchQuestions, initQuestionBank } from "@/lib/question-bank";
import { Input } from "@/components/ui/input";
import { InterveDotsLoader } from "@/components/interve-ui/loading";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { MagneticWrapper } from "@/components/ui/magnetic-wrapper";
import Link from "next/link";

export default function PracticeHubPage() {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | undefined>();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadIndex() {
      await initQuestionBank();
      const initial = await searchQuestions("");
      setQuestions(initial);
      setIsReady(true);
    }
    loadIndex();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    async function fetchResults() {
      const results = await searchQuestions(searchTerm, activeCategory);
      setQuestions(results);
    }
    const timer = setTimeout(fetchResults, 150); // debounce search
    return () => clearTimeout(timer);
  }, [searchTerm, activeCategory, isReady]);

  const categories = [
    { id: undefined, label: "All Topics", icon: Compass },
    { id: "Behavioral", label: "Behavioral", icon: Layers },
    { id: "Technical", label: "Technical", icon: Target },
    { id: "System Design", label: "System Design", icon: Layers },
    { id: "Leadership", label: "Leadership", icon: Target },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center">
      {/* Background Liquid Glass Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-sky-100/40 rounded-full blur-[120px] pointer-events-none" />

      <main className="w-full max-w-6xl px-4 py-16 relative z-10 flex flex-col gap-12">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 border border-black/[0.03] text-sm text-muted-foreground backdrop-blur-md">
            <Compass className="w-4 h-4 text-emerald-600" />
            <span>Interactive Practice Hub</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
            Master the <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-sky-600">Interview</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Browse our curated bank of behavioral and technical questions. Instantly start a micro-interview session tailored to your weaknesses.
          </p>

          <div className="flex justify-center gap-4 pt-4">
            <MagneticWrapper intensity={0.15}>
              <Link href="/setup?framework=star&mode=behavioral" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-base font-medium text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-md">
                <Layers className="w-5 h-5" />
                Start Full Behavioral Interview
              </Link>
            </MagneticWrapper>
          </div>
        </motion.div>

        {/* Search & Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-6 w-full max-w-3xl mx-auto"
        >
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-emerald-600 transition-colors" />
            <Input
              type="text"
              placeholder="Search for 'System Design', 'Conflict Resolution'..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-14 pl-12 rounded-[20px] bg-white/70 backdrop-blur-xl border-zinc-200/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_32px_rgba(0,0,0,0.04)] focus-visible:ring-emerald-500/30 text-base"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <MagneticWrapper key={cat.id || "all"} intensity={0.1}>
                  <button
                    onClick={() => setActiveCategory(cat.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all duration-300 ${
                      isActive
                        ? "bg-foreground text-background shadow-md"
                        : "bg-white/50 text-muted-foreground hover:bg-white/80 hover:text-foreground border border-black/5"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {cat.label}
                  </button>
                </MagneticWrapper>
              );
            })}
          </div>
        </motion.div>

        {/* Question Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {!isReady && (
            <div className="col-span-full flex justify-center py-[120px]">
              <InterveDotsLoader size="md" />
            </div>
          )}
          
          {isReady && questions.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                <Search className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-lg font-medium text-foreground">No questions found</p>
              <p className="text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          )}

          {questions.map((q, i) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="h-full"
            >
              <Link href={`/practice/${q.id}`} className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl">
                <SpotlightCard 
                  tabIndex={-1} 
                  role="button"
                  className="h-full cursor-pointer flex flex-col group/practice"
                >
                  <CardHeader className="flex-none">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-none">
                        {q.category}
                      </Badge>
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center opacity-0 group-hover/practice:opacity-100 transition-opacity text-emerald-600">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>
                    <CardTitle className="line-clamp-2">{q.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <CardDescription className="line-clamp-3">
                      {q.description}
                    </CardDescription>
                  </CardContent>
                  <div className="px-4 pb-4 mt-auto flex flex-wrap gap-1.5 pt-4">
                    {q.tags.map(tag => (
                      <span key={tag} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100/80 text-slate-500">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </SpotlightCard>
              </Link>
            </motion.div>
          ))}
        </motion.div>

      </main>
    </div>
  );
}
