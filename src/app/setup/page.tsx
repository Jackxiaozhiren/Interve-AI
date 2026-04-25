"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { 
  Code, Database, Briefcase, ChartLineUp,
  Sword, HandsClapping, Brain,
  CaretRight, FileText, CheckCircle, Lightning,
  UploadSimple, FilePdf, CircleNotch, Trash, TerminalWindow, Microphone, WarningCircle,
  VideoCamera, WifiHigh, WifiLow, WifiSlash, SpeakerHigh, PlayCircle
} from "@phosphor-icons/react";
import { waterfallVariant } from "@/lib/motion";
import { toast } from "sonner";
import { useInterveStore } from "@/store/useInterveStore";
import { WaveformVisualizer } from "@/components/setup/WaveformVisualizer";
import { TextSelectionMenu } from "@/components/setup/TextSelectionMenu";

const roles = [
  { id: "frontend", name: "Frontend Engineer", icon: Code },
  { id: "backend", name: "Backend Engineer", icon: Database },
  { id: "pm", name: "Product Manager", icon: Briefcase },
  { id: "data", name: "Data Scientist", icon: ChartLineUp },
];

const levels = ["Intern", "Junior", "Mid-Level", "Senior", "Staff/Principal"];

const personas = [
  { 
    id: "supportive", 
    name: "Supportive Mentor", 
    desc: "Warm and encouraging. Focuses on guiding you to the right answer.",
    icon: HandsClapping,
    color: "text-emerald-600",
    bg: "from-emerald-50 to-emerald-100/40",
    border: "border-emerald-200/50"
  },
  { 
    id: "technical", 
    name: "Technical Drill", 
    desc: "Deep-dives into system design, architecture, and edge cases.",
    icon: Brain,
    color: "text-sky-600",
    bg: "from-sky-50 to-sky-100/40",
    border: "border-sky-200/50"
  },
  { 
    id: "aggressive", 
    name: "Stress Test", 
    desc: "Fast-paced, high-pressure. Challenges your assumptions and pushes limits.",
    icon: Sword,
    color: "text-rose-600",
    bg: "from-rose-50 to-rose-100/40",
    border: "border-rose-200/50"
  },
];

const frameworksList = [
  { id: "general", name: "General", desc: "Free-flowing conversation with varied question types." },
  { id: "star", name: "STAR Method", desc: "Strict enforcement of Situation, Task, Action, and Result formatting." },
  { id: "behavioral", name: "Behavioral Deep Dive", desc: "Focuses heavily on past experiences, conflict resolution, and leadership." },
];

const companiesList = [
  { id: "general", name: "General Tech", desc: "Standard industry interview, not tailored to a specific company culture." },
  { id: "google", name: "Google", desc: "Focuses on complex algorithms, systems design, and 'Googliness'." },
  { id: "amazon", name: "Amazon", desc: "Heavy emphasis on the 16 Leadership Principles." },
  { id: "meta", name: "Meta", desc: "Fast-paced execution, problem-solving speed, and deep domain knowledge." },
  { id: "startup", name: "High-Growth Startup", desc: "Bias for action, zero-to-one building, and extreme ownership." },
];

export default function SetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;
  const [selectedRole, setSelectedRole] = useState("frontend");
  const [selectedLevel, setSelectedLevel] = useState("Mid-Level");
  const [selectedPersona, setSelectedPersona] = useState("supportive");
  const [selectedCompany, setSelectedCompany] = useState("general");
  const [framework, setFramework] = useState("general");
  const [stressTest, setStressTest] = useState(false);
  const [aiModel, setAiModel] = useState("zhipu");
  const [context, setContext] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const fw = urlParams.get("framework");
      if (fw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFramework(fw);
      }
      const mode = urlParams.get("mode");
      if (mode === "behavioral") {
         
        setContext("Focus strongly on behavioral and soft-skills, prioritizing HR/Culture Fit evaluation.");
      }
    }
  }, []);

  const { 
    resumeText: storeResumeText, 
    jobDescription: storeJd, 
    currentInterviewId, 
    cheatsheet, 
    topPredictions 
  } = useInterveStore();

  // Technical Assessment State
  const [includeCoding, setIncludeCoding] = useState(false);
  const [problemStatement, setProblemStatement] = useState("");
  
  // Resume upload state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResumeText, setParsedResumeText] = useState("");

  // Hydrate from store
  useEffect(() => {
    if (storeResumeText && !parsedResumeText) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setParsedResumeText(storeResumeText);
    }
    if (storeJd && !context) {
       
      setContext(storeJd);
    }
  }, [storeResumeText, storeJd, parsedResumeText, context]);
  
  // Hardware check state
  const [micStatus, setMicStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [camStatus, setCamStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [networkStatus, setNetworkStatus] = useState<"checking" | "good" | "poor" | "offline">("checking");
  const [speakerTestPlaying, setSpeakerTestPlaying] = useState(false);
  const [, setAudioLevel] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (currentStep !== 6) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setTimeout(() => {
        setMicStatus("idle");
        setCamStatus("idle");
        setAudioLevel(0);
      }, 0);
      return;
    }

    const testHardware = async () => {
      await Promise.resolve();
      setMicStatus("testing");
      setCamStatus("testing");
      setNetworkStatus("checking");
      
      // Network check
      if (!navigator.onLine) {
        setNetworkStatus("offline");
      } else {
        const conn = (navigator as unknown as { connection?: { rtt: number; downlink: number } }).connection;
        if (conn && (conn.rtt > 300 || conn.downlink < 1)) {
          setNetworkStatus("poor");
        } else {
          setNetworkStatus("good");
        }
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCamStatus("success");
        
        const AudioContext = window.AudioContext || (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        
        const analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        analyserRef.current = analyserNode;
        setAnalyser(analyserNode);
        
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyserNode);
        
        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        
        const updateAudioLevel = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const normalized = Math.min(100, (average / 128) * 100);
          setAudioLevel(normalized);
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        };
        updateAudioLevel();
        setMicStatus("success");
      } catch (err: unknown) {
        console.error("Hardware access error:", err);
        setMicStatus("error");
        setCamStatus("error");
        if (err instanceof Error) {
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            setErrorMessage("Browser blocked camera/microphone access. Please allow access in your URL bar and try again.");
          } else if (err.name === "NotFoundError") {
            setErrorMessage("No camera/microphone detected. Please plug in a device.");
          } else {
            setErrorMessage("An error occurred while accessing the camera/microphone.");
          }
        } else {
          setErrorMessage("An error occurred while accessing the camera/microphone.");
        }
      }
    };

    testHardware();
    
    return () => {
       if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentStep]);
  // Alignment Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [alignmentReport, setAlignmentReport] = useState<{
    matchScore: number;
    strengths: string[];
    gaps: string[];
    recommendedFocus: string;
  } | null>(null);

  const [hasAutoAnalyzed, setHasAutoAnalyzed] = useState(false);


  const analyzeAlignment = async () => {
    if (!parsedResumeText || !context) {
      toast.error("Missing Data", { description: "Please upload a resume and provide context (JD) first." });
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-alignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: parsedResumeText, jobDescription: context }),
      });
      const data = await res.json();
      if (data.matchScore !== undefined) {
        setAlignmentReport(data);
        // Automatically append to context if not already added
        if (!context.includes("RECOMMENDED FOCUS:")) {
            
           setContext(prev => prev + `\n\nRECOMMENDED FOCUS: ${data.recommendedFocus}`);
        }
        toast.success("Analysis Complete", { description: "Alignment report generated successfully." });
      } else {
        toast.error("Analysis Failed", { description: "Could not generate report." });
      }
    } catch (err) {
      console.error(err);
      toast.error("Analysis Error", { description: "Something went wrong during analysis." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    // Auto-analyze if we have both parsedResumeText and context, but haven't analyzed yet
    if (parsedResumeText && context && !alignmentReport && !isAnalyzing && !hasAutoAnalyzed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasAutoAnalyzed(true);
      // Let React settle before calling analyzeAlignment
      setTimeout(() => analyzeAlignment(), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedResumeText, context, alignmentReport, isAnalyzing, hasAutoAnalyzed]);

  const handleFileUpload = async (uploadedFile: File) => {
    if (!uploadedFile || uploadedFile.type !== "application/pdf") {
      toast.error("Invalid file", {
        description: "Please upload a valid PDF file.",
      });
      return;
    }
    setFile(uploadedFile);
    setIsParsing(true);
    
    const formData = new FormData();
    formData.append("file", uploadedFile);
    
    try {
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      
      if (res.ok && data.text) {
        setParsedResumeText(data.text);
      } else {
        if (res.status === 422) {
           toast.error("Extraction failed", {
             description: data.error || "Please upload a standard text-based PDF.",
           });
        } else {
           toast.error("Extraction failed", {
             description: "Could not extract text from this PDF.",
           });
        }
        setFile(null);
      }
    } catch (err) {
      console.error("Failed to parse resume:", err);
      toast.error("Parsing Error", {
        description: "An error occurred while parsing the resume.",
      });
      setFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  // Session start loading state
  const confirmAndStart = async () => {
    if (isStarting) return; // Prevent double-clicks
    setIsStarting(true);
    try {
      let interviewId = currentInterviewId;
      
      const interviewData = {
        title: `${selectedLevel} ${roles.find(r => r.id === selectedRole)?.name || selectedRole} Interview`,
        jobDescription: context.substring(0, 500),
        resumeText: parsedResumeText,
        includeCoding,
        problemStatement,
        status: 'in_progress' as const,
        matchData: alignmentReport ? {
          overallScore: alignmentReport.matchScore,
          alignedSkills: alignmentReport.strengths,
          missingSkills: alignmentReport.gaps,
          recommendations: [alignmentReport.recommendedFocus]
        } : undefined,
        updatedAt: new Date(),
      };

      if (interviewId) {
        await db.interviews.update(interviewId, interviewData);
      } else {
        interviewId = await db.interviews.add({
          ...interviewData,
          cheatsheet: cheatsheet || [],
          topPredictions: topPredictions || [],
          createdAt: new Date(),
        }) as number;
      }

      if (!interviewId) {
        toast.error("Session Error", { description: "Failed to create interview session in database." });
        return;
      }

      const params = new URLSearchParams({
        id: interviewId.toString(),
        role: selectedRole,
        level: selectedLevel,
        persona: selectedPersona,
        company: selectedCompany,
        framework: framework,
        stressTest: stressTest.toString(),
        aiModel: aiModel,
        context: context.substring(0, 500)
      });
      router.push(`/interview?${params.toString()}`);
    } catch (err) {
      console.error("Failed to start interview session:", err);
      toast.error("Session Error", { description: "Something went wrong while starting the session. Please try again." });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafcff] text-[#0f172a] overflow-hidden selection:bg-sky-500/20">
      <TextSelectionMenu 
        onEnhance={() => toast.success("Text enhanced (mock)")} 
        onSummarize={() => toast.success("Text summarized (mock)")} 
      />
      <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row min-h-screen relative">
        
        {/* Left Side: Editorial Typography & Ambient Glass (Sticky) */}
        <div className="lg:w-[45%] lg:sticky lg:top-0 lg:h-screen p-8 lg:p-16 flex flex-col justify-between relative z-10 border-r border-slate-200/40 bg-white/30 backdrop-blur-3xl">
          {/* Advanced Mesh Gradient Background */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
             <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-sky-300/30 rounded-full blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '10s' }} />
             <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-emerald-300/20 rounded-full blur-[100px] mix-blend-multiply" />
             <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-teal-200/20 rounded-full blur-[100px] mix-blend-multiply" />
          </div>
          
          <motion.div 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-[3.5rem] md:text-[5rem] font-serif tracking-tighter text-slate-900 leading-[1.05] mb-6 drop-shadow-sm">
              Design<br />Your Target<br />
              <span className="relative inline-block">
                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-teal-500 to-emerald-500 drop-shadow-sm">Interview.</span>
                 <motion.div 
                   className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full opacity-30"
                   initial={{ scaleX: 0, opacity: 0 }}
                   animate={{ scaleX: 1, opacity: 0.3 }}
                   transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
                   style={{ transformOrigin: 'left' }}
                 />
              </span>
            </h1>
            <p className="text-slate-500 font-medium text-lg max-w-sm leading-relaxed tracking-wide">
              Calibrate the AI&apos;s technical depth, personality, and focus areas to match your exact career goals.
            </p>
          </motion.div>

          {/* Liquid Glass Info Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="hidden lg:block mt-12 p-8 rounded-[32px] bg-white/70 border border-white/90 shadow-[0_12px_40px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,1)] backdrop-blur-xl relative overflow-hidden group hover:shadow-[0_16px_50px_rgba(0,0,0,0.08)] transition-all duration-500"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-white/20 to-transparent pointer-events-none group-hover:from-white/80 transition-all duration-500" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-3 h-3">
                  <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
                  <div className="absolute inset-[2px] rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                </div>
                <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">System Ready</span>
              </div>
              <p className="text-slate-600 font-medium leading-relaxed">Model engines are primed. Configure parameters on the right to initialize your personalized session.</p>
            </div>
          </motion.div>
        </div>

        {/* Right Side: Scrollable Forms (Bento UI) */}
        <div className="lg:w-[55%] p-8 lg:p-16 lg:py-24 overflow-y-auto z-10 flex flex-col">
          <div className="max-w-2xl mx-auto w-full flex-grow flex flex-col">
            {/* Stepper Progress */}
            <div className="mb-12 flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 rounded-full -z-10 overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-sky-400 to-emerald-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              </div>
              {[1, 2, 3, 4, 5, 6].map((step) => (
                <div 
                  key={step}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 ${
                    currentStep === step 
                      ? "bg-slate-900 text-white shadow-md scale-110" 
                      : currentStep > step 
                        ? "bg-emerald-500 text-white" 
                        : "bg-white border-2 border-slate-200 text-slate-400"
                  }`}
                >
                  {currentStep > step ? <CheckCircle weight="bold" className="w-5 h-5" /> : step}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="space-y-12 flex-grow"
              >
            
            {currentStep === 1 && (<>
            {/* Target Role */}
            <motion.section variants={waterfallVariant} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                <h2 className="text-2xl font-serif tracking-tight text-slate-800">Target Role</h2>
                <span className="text-sky-400/60 font-mono text-sm font-bold">01</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 relative">
                {roles.map((role) => {
                  const Icon = role.icon;
                  const isSelected = selectedRole === role.id;
                  return (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      className={`group relative p-6 rounded-[24px] text-left transition-all duration-400 outline-none flex flex-col gap-4 border ${
                        isSelected 
                          ? "border-sky-200/60 bg-white shadow-[0_12px_40px_rgba(14,165,233,0.08)]" 
                          : "border-slate-200/40 bg-white/40 hover:bg-white/80 hover:border-slate-300/60 hover:shadow-[0_8px_24px_rgba(0,0,0,0.03)]"
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="role-active-bg"
                          className="absolute inset-0 bg-white rounded-[24px] shadow-[inset_0_0_0_1px_rgba(14,165,233,0.1)]"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                        />
                      )}
                      <div className="relative z-10 flex justify-between items-start">
                        <div className={`p-3 rounded-[16px] transition-colors duration-300 ${
                          isSelected ? 'bg-sky-50/80 text-sky-600 shadow-sm border border-sky-100/50' : 'bg-slate-50 text-slate-400 group-hover:text-slate-500'
                        }`}>
                           <Icon className="w-6 h-6" weight={isSelected ? "duotone" : "regular"} />
                        </div>
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}>
                              <CheckCircle className="w-6 h-6 text-sky-500 drop-shadow-sm" weight="fill" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <span className={`relative z-10 font-semibold tracking-wide text-[15px] transition-colors duration-300 ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                        {role.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Levels */}
              <div className="pt-6 flex flex-wrap gap-2.5">
                {levels.map((level) => {
                  const isSelected = selectedLevel === level;
                  return (
                    <button
                      key={level}
                      onClick={() => setSelectedLevel(level)}
                      className={`relative px-6 py-2.5 rounded-full text-[14px] font-semibold tracking-wide transition-all duration-300 outline-none border ${
                        isSelected 
                          ? "text-white border-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.2)]" 
                          : "text-slate-500 bg-white/50 border-slate-200/60 hover:bg-white hover:text-slate-800 hover:border-slate-300 hover:shadow-sm"
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="level-active-bg"
                          className="absolute inset-0 bg-slate-900 rounded-full"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <span className="relative z-10">{level}</span>
                    </button>
                  );
                })}
              </div>
            </motion.section>

            </>)}
            {currentStep === 2 && (<>
            {/* Target Company */}
            <motion.section variants={waterfallVariant} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                <h2 className="text-2xl font-serif tracking-tight text-slate-800">Target Company</h2>
                <span className="text-sky-400/60 font-mono text-sm font-bold">02</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 relative">
                {companiesList.map((company) => {
                  const isSelected = selectedCompany === company.id;
                  return (
                    <button
                      key={company.id}
                      onClick={() => setSelectedCompany(company.id)}
                      className={`group relative p-6 rounded-[24px] text-left transition-all duration-400 outline-none flex flex-col gap-2 border ${
                        isSelected 
                          ? "border-sky-200/60 bg-white shadow-[0_12px_40px_rgba(14,165,233,0.08)]" 
                          : "border-slate-200/40 bg-white/40 hover:bg-white/80 hover:border-slate-300/60 hover:shadow-[0_8px_24px_rgba(0,0,0,0.03)]"
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="company-active-bg"
                          className="absolute inset-0 bg-white rounded-[24px] shadow-[inset_0_0_0_1px_rgba(14,165,233,0.1)]"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                        />
                      )}
                      <span className={`relative z-10 font-semibold tracking-wide text-[15px] transition-colors duration-300 ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                        {company.name}
                      </span>
                      <p className={`relative z-10 text-[13px] leading-relaxed transition-colors duration-300 ${isSelected ? 'text-slate-600' : 'text-slate-400'}`}>
                        {company.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </motion.section>

            </>)}
            {currentStep === 3 && (<>
            {/* Persona */}
            <motion.section variants={waterfallVariant} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                <h2 className="text-2xl font-serif tracking-tight text-slate-800">Interviewer Persona</h2>
                <span className="text-sky-400/60 font-mono text-sm font-bold">03</span>
              </div>
              
              <div className="flex flex-col gap-4 relative">
                {personas.map((persona) => {
                  const Icon = persona.icon;
                  const isSelected = selectedPersona === persona.id;
                  return (
                    <button
                      key={persona.id}
                      onClick={() => setSelectedPersona(persona.id)}
                      className={`group relative p-6 rounded-[28px] text-left transition-all duration-400 outline-none flex items-center gap-6 border ${
                        isSelected 
                          ? `${persona.border} shadow-[0_12px_40px_rgba(0,0,0,0.06)]`
                          : "border-slate-200/40 bg-white/40 hover:bg-white/80 hover:border-slate-300/60 hover:shadow-[0_8px_24px_rgba(0,0,0,0.03)]"
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="persona-active-bg"
                          className={`absolute inset-0 bg-gradient-to-r ${persona.bg} rounded-[28px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]`}
                          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                        />
                      )}
                      <div className={`relative z-10 p-4 rounded-[20px] shrink-0 transition-colors duration-300 ${
                        isSelected ? 'bg-white shadow-sm border border-white' : 'bg-slate-50/80 group-hover:bg-slate-100 text-slate-400'
                      }`}>
                        <Icon className={`w-7 h-7 ${isSelected ? persona.color : ''}`} weight={isSelected ? "duotone" : "regular"} />
                      </div>
                      <div className="relative z-10 flex-grow">
                        <h3 className={`text-lg font-serif font-medium mb-1 transition-colors duration-300 ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                          {persona.name}
                        </h3>
                        <p className={`text-[14px] leading-relaxed transition-colors duration-300 ${isSelected ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                          {persona.desc}
                        </p>
                      </div>
                      <div className="relative z-10 shrink-0 pr-2">
                         <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                            isSelected ? "border-slate-900 bg-white" : "border-slate-300/80 bg-slate-50/50"
                          }`}>
                            <AnimatePresence>
                              {isSelected && (
                                <motion.div 
                                  initial={{ scale: 0 }} 
                                  animate={{ scale: 1 }} 
                                  exit={{ scale: 0 }}
                                  className="w-2.5 h-2.5 rounded-full bg-slate-900" 
                                />
                              )}
                            </AnimatePresence>
                          </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.section>

            {/* Framework */}
            <motion.section variants={waterfallVariant} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                <h2 className="text-2xl font-serif tracking-tight text-slate-800">Interview Framework</h2>
                <span className="text-sky-400/60 font-mono text-sm font-bold">04</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 relative">
                {frameworksList.map((fw) => {
                  const isSelected = framework === fw.id;
                  return (
                    <button
                      key={fw.id}
                      onClick={() => setFramework(fw.id)}
                      className={`group relative p-6 rounded-[24px] text-left transition-all duration-400 outline-none flex flex-col gap-2 border ${
                        isSelected 
                          ? "border-sky-200/60 bg-white shadow-[0_12px_40px_rgba(14,165,233,0.08)]" 
                          : "border-slate-200/40 bg-white/40 hover:bg-white/80 hover:border-slate-300/60 hover:shadow-[0_8px_24px_rgba(0,0,0,0.03)]"
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="framework-active-bg"
                          className="absolute inset-0 bg-white rounded-[24px] shadow-[inset_0_0_0_1px_rgba(14,165,233,0.1)]"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                        />
                      )}
                      <span className={`relative z-10 font-semibold tracking-wide text-[15px] transition-colors duration-300 ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                        {fw.name}
                      </span>
                      <p className={`relative z-10 text-[13px] leading-relaxed transition-colors duration-300 ${isSelected ? 'text-slate-600' : 'text-slate-400'}`}>
                        {fw.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </motion.section>

            {/* Stress Test */}
            <motion.section variants={waterfallVariant} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                <h2 className="text-2xl font-serif tracking-tight text-slate-800">Stress Test Mode</h2>
                <span className="text-sky-400/60 font-mono text-sm font-bold">05</span>
              </div>
              
              <button
                onClick={() => setStressTest(!stressTest)}
                className={`w-full group relative p-6 rounded-[28px] text-left transition-all duration-500 outline-none flex items-center justify-between border ${
                  stressTest 
                    ? "border-rose-300/60 shadow-[0_12px_40px_rgba(244,63,94,0.15)] bg-rose-50/40" 
                    : "border-slate-200/40 bg-white/40 hover:bg-white/80 hover:border-slate-300/60 hover:shadow-[0_8px_24px_rgba(0,0,0,0.03)]"
                }`}
              >
                {stressTest && (
                  <motion.div
                    layoutId="stress-active-bg"
                    className="absolute inset-0 bg-gradient-to-r from-rose-50/50 to-rose-100/30 rounded-[28px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-6">
                  <div className={`p-4 rounded-[20px] transition-all duration-500 ${
                    stressTest 
                      ? "bg-rose-500 shadow-[0_4px_20px_rgba(244,63,94,0.4)] text-white scale-110" 
                      : "bg-slate-50/80 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-500"
                  }`}>
                    <Lightning className="w-7 h-7" weight={stressTest ? "fill" : "regular"} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-serif font-medium mb-1 transition-colors duration-300 ${stressTest ? 'text-rose-900' : 'text-slate-700'}`}>
                      FAANG Intensity
                    </h3>
                    <p className={`text-[14px] leading-relaxed transition-colors duration-300 ${stressTest ? 'text-rose-700/80' : 'text-slate-500'}`}>
                      Enable dynamic interruptions, tight constraints, and sharp follow-ups.
                    </p>
                  </div>
                </div>
                
                {/* Toggle Switch */}
                <div className={`relative z-10 w-14 h-8 rounded-full transition-colors duration-500 flex items-center px-1 ${
                  stressTest ? "bg-rose-500 shadow-inner" : "bg-slate-200"
                }`}>
                  <motion.div 
                    layout
                    className={`w-6 h-6 rounded-full bg-white shadow-md ${stressTest ? "ml-auto" : ""}`}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </div>
              </button>
            </motion.section>

            </>)}
            {currentStep === 4 && (<>
            {/* AI Model Selection */}
            <motion.section variants={waterfallVariant} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                <h2 className="text-2xl font-serif tracking-tight text-slate-800">AI Model Engine</h2>
                <span className="text-sky-400/60 font-mono text-sm font-bold">04</span>
              </div>
              
              <div className="flex flex-col gap-4 relative">
                {[
                  { id: "zhipu", name: "Zhipu AI (GLM-4)", desc: "Fast & cost-effective, optimized for bilingual (CN/EN) interviews.", icon: Brain, color: "text-emerald-600" },
                  { id: "openai", name: "OpenAI (GPT-4o)", desc: "Industry standard, highly capable across all domains.", icon: Brain, color: "text-sky-600" },
                  { id: "gemini", name: "Google Gemini (1.5 Pro)", desc: "Fast analysis and excellent multimodal capabilities.", icon: Brain, color: "text-indigo-600" }
                ].map((model) => {
                  const Icon = model.icon;
                  const isSelected = aiModel === model.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => setAiModel(model.id)}
                      className={`group relative p-6 rounded-[24px] text-left transition-all duration-400 outline-none flex items-center gap-6 border ${
                        isSelected 
                          ? "border-sky-300 shadow-[0_12px_40px_rgba(14,165,233,0.1)] bg-white"
                          : "border-slate-200/40 bg-white/40 hover:bg-white/80 hover:border-slate-300/60"
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="model-active-bg"
                          className="absolute inset-0 rounded-[24px] shadow-[inset_0_0_0_1px_rgba(14,165,233,0.1)]"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                        />
                      )}
                      <div className={`relative z-10 p-4 rounded-[20px] shrink-0 transition-colors duration-300 ${
                        isSelected ? 'bg-sky-50 border border-sky-100' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'
                      }`}>
                        <Icon className={`w-7 h-7 ${isSelected ? model.color : ''}`} weight={isSelected ? "duotone" : "regular"} />
                      </div>
                      <div className="relative z-10 flex-grow">
                        <h3 className={`text-lg font-serif font-medium mb-1 transition-colors duration-300 ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                          {model.name}
                        </h3>
                        <p className={`text-[14px] leading-relaxed transition-colors duration-300 ${isSelected ? 'text-slate-600 font-medium' : 'text-slate-500'}`}>
                          {model.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.section>
            </>)}
            {currentStep === 5 && (<>
            {/* Resume Upload (New Phase 4 Feature) */}
            <motion.section variants={waterfallVariant} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                <h2 className="text-2xl font-serif tracking-tight text-slate-800">Resume Integration</h2>
                <span className="text-sky-400/60 font-mono text-sm font-bold">05</span>
              </div>
              
              <div 
                className={`relative group rounded-[28px] overflow-hidden transition-all duration-500 border-2 border-dashed ${
                  isDragging 
                    ? "border-sky-400 bg-sky-50/50" 
                    : file 
                      ? "border-emerald-300/60 bg-emerald-50/30" 
                      : "border-slate-200 hover:border-sky-300 hover:bg-slate-50/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
              >
                <div className="absolute inset-0 bg-white/40 backdrop-blur-md pointer-events-none z-0" />
                
                <div className="relative z-10 p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
                  {isParsing ? (
                    <div className="flex flex-col items-center gap-4">
                      <CircleNotch className="w-10 h-10 text-sky-500 animate-spin" />
                      <p className="text-sm font-medium text-slate-600">Extracting context from PDF...</p>
                    </div>
                  ) : file ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 shadow-sm">
                        <FilePdf className="w-8 h-8 text-emerald-600" weight="duotone" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{file.name}</p>
                        <p className="text-xs font-mono text-slate-500 mt-1">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • {parsedResumeText.length} chars extracted
                        </p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setParsedResumeText("");
                        }}
                        className="mt-2 text-xs font-semibold text-rose-500 flex items-center gap-1 hover:text-rose-600 transition-colors bg-white/80 px-3 py-1.5 rounded-full shadow-sm border border-rose-100"
                      >
                        <Trash weight="bold" /> Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 cursor-pointer" onClick={() => document.getElementById("resume-upload")?.click()}>
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm group-hover:scale-105 transition-transform duration-300">
                        <UploadSimple className="w-8 h-8 text-slate-500 group-hover:text-sky-500 transition-colors" weight="duotone" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">Drag & drop your resume</p>
                        <p className="text-sm text-slate-500 mt-1">PDF format up to 5MB</p>
                      </div>
                      <input 
                        type="file" 
                        id="resume-upload" 
                        accept="application/pdf" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleFileUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.section>

            {/* Context */}
            <motion.section variants={waterfallVariant} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                <h2 className="text-2xl font-serif tracking-tight text-slate-800">Additional Context</h2>
                <span className="text-sky-400/60 font-mono text-sm font-bold">06</span>
              </div>
              
              <div className="relative group">
                <div className="absolute inset-0 bg-white/70 rounded-[28px] backdrop-blur-xl border border-white/90 shadow-[0_8px_32px_rgba(0,0,0,0.03),inset_0_2px_4px_rgba(0,0,0,0.02)] pointer-events-none transition-all duration-300 group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.05),inset_0_2px_4px_rgba(0,0,0,0.02)]" />
                <div className="absolute top-6 left-6 text-slate-300 pointer-events-none">
                  <FileText className="w-6 h-6" />
                </div>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Paste job description, specific skills to test, or your resume background here..."
                  className="relative w-full bg-transparent border-0 focus:ring-0 resize-none h-44 p-6 pl-16 text-[15px] text-slate-700 placeholder:text-slate-400/80 font-medium outline-none rounded-[28px] focus:bg-white/50 transition-colors"
                />
                <div className="absolute bottom-5 right-6 text-xs text-slate-400 font-mono font-bold bg-white/80 px-2 py-1 rounded-md border border-slate-100 shadow-sm backdrop-blur-md">
                  {context.length}/500
                </div>
              </div>
            </motion.section>

            {/* Alignment Analysis */}
            <motion.section variants={waterfallVariant} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                <h2 className="text-2xl font-serif tracking-tight text-slate-800">Resume Alignment</h2>
                <span className="text-sky-400/60 font-mono text-sm font-bold">07</span>
              </div>
              
              {!alignmentReport ? (
                <div className="p-8 rounded-[28px] border border-slate-200/60 bg-white/40 backdrop-blur-sm flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
                    <ChartLineUp className="w-8 h-8 text-indigo-500" weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Analyze Fit Before Starting</h3>
                    <p className="text-slate-500 text-sm max-w-sm mt-1 mx-auto">Upload a resume and provide a JD above to see how well you match, and let our AI interviewer automatically adjust its focus.</p>
                  </div>
                  <Button 
                    onClick={analyzeAlignment}
                    disabled={!parsedResumeText || !context || isAnalyzing}
                    className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 shadow-sm transition-all"
                  >
                    {isAnalyzing ? (
                      <><CircleNotch className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                    ) : (
                      <><Lightning className="w-4 h-4 mr-2" weight="fill" /> Analyze Alignment</>
                    )}
                  </Button>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-8 rounded-[28px] border border-indigo-200/60 bg-indigo-50/30 backdrop-blur-sm space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Alignment Report</h3>
                      <p className="text-sm text-slate-500">Based on your resume and JD</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button onClick={analyzeAlignment} disabled={isAnalyzing} variant="outline" size="sm" className="rounded-full h-8 text-xs font-semibold">
                        {isAnalyzing ? "Re-analyzing..." : "Re-analyze"}
                      </Button>
                      <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-indigo-100"
                            strokeWidth="3"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className={`${alignmentReport.matchScore >= 80 ? 'text-emerald-500' : alignmentReport.matchScore >= 50 ? 'text-amber-500' : 'text-rose-500'}`}
                            strokeDasharray={`${alignmentReport.matchScore}, 100`}
                            strokeWidth="3"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <span className="absolute text-sm font-bold text-slate-800">{alignmentReport.matchScore}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" weight="fill" /> Key Strengths
                      </h4>
                      <ul className="space-y-2">
                        {alignmentReport.strengths.map((s, i) => (
                          <li key={i} className="text-sm text-slate-700 bg-emerald-100/50 px-3 py-1.5 rounded-lg border border-emerald-200/50">{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-rose-700 flex items-center gap-2">
                        <ChartLineUp className="w-4 h-4" weight="fill" /> Potential Gaps
                      </h4>
                      <ul className="space-y-2">
                        {alignmentReport.gaps.map((g, i) => (
                          <li key={i} className="text-sm text-slate-700 bg-rose-100/50 px-3 py-1.5 rounded-lg border border-rose-200/50">{g}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.section>

            {/* Technical Assessment */}
            <motion.section variants={waterfallVariant} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                <h2 className="text-2xl font-serif tracking-tight text-slate-800">Technical Assessment</h2>
                <span className="text-sky-400/60 font-mono text-sm font-bold">08</span>
              </div>
              
              <button
                onClick={() => setIncludeCoding(!includeCoding)}
                className={`w-full group relative p-6 rounded-[28px] text-left transition-all duration-500 outline-none flex items-center justify-between border ${
                  includeCoding 
                    ? "border-sky-300/60 shadow-[0_12px_40px_rgba(14,165,233,0.15)] bg-sky-50/40" 
                    : "border-slate-200/40 bg-white/40 hover:bg-white/80 hover:border-slate-300/60 hover:shadow-[0_8px_24px_rgba(0,0,0,0.03)]"
                }`}
              >
                {includeCoding && (
                  <motion.div
                    layoutId="coding-active-bg"
                    className="absolute inset-0 bg-gradient-to-r from-sky-50/50 to-sky-100/30 rounded-[28px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-6">
                  <div className={`p-4 rounded-[20px] transition-all duration-500 ${
                    includeCoding 
                      ? "bg-sky-500 shadow-[0_4px_20px_rgba(14,165,233,0.4)] text-white scale-110" 
                      : "bg-slate-50/80 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-500"
                  }`}>
                    <TerminalWindow className="w-7 h-7" weight={includeCoding ? "fill" : "regular"} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-serif font-medium mb-1 transition-colors duration-300 ${includeCoding ? 'text-sky-900' : 'text-slate-700'}`}>
                      Coding Sandbox
                    </h3>
                    <p className={`text-[14px] leading-relaxed transition-colors duration-300 ${includeCoding ? 'text-sky-700/80' : 'text-slate-500'}`}>
                      Enable the built-in code editor and technical problem statement during the interview.
                    </p>
                  </div>
                </div>
                
                {/* Toggle Switch */}
                <div className={`relative z-10 w-14 h-8 rounded-full transition-colors duration-500 flex items-center px-1 ${
                  includeCoding ? "bg-sky-500 shadow-inner" : "bg-slate-200"
                }`}>
                  <motion.div 
                    layout
                    className={`w-6 h-6 rounded-full bg-white shadow-md ${includeCoding ? "ml-auto" : ""}`}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </div>
              </button>

              <AnimatePresence>
                {includeCoding && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="relative group overflow-hidden rounded-[28px]"
                  >
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-xl border border-sky-100/80 shadow-[0_8px_32px_rgba(14,165,233,0.05),inset_0_2px_4px_rgba(255,255,255,0.8)] pointer-events-none transition-all duration-300 group-hover:shadow-[0_12px_40px_rgba(14,165,233,0.08)]" />
                    <div className="absolute top-6 left-6 text-sky-400 pointer-events-none">
                      <Code className="w-6 h-6" />
                    </div>
                    <textarea
                      value={problemStatement}
                      onChange={(e) => setProblemStatement(e.target.value)}
                      placeholder="Paste the technical problem statement here (e.g. LeetCode problem, React component requirements)..."
                      className="relative w-full bg-transparent border-0 focus:ring-0 resize-none h-44 p-6 pl-16 text-[15px] text-slate-700 placeholder:text-slate-400/80 font-medium outline-none focus:bg-sky-50/30 transition-colors"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>

            </>)}
            {currentStep === 6 && (
              <motion.section variants={waterfallVariant} className="space-y-8">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                  <h2 className="text-2xl font-serif tracking-tight text-slate-800">Hardware Check</h2>
                  <span className="text-emerald-400/80 font-mono text-sm font-bold">05</span>
                </div>
                
                <div className="bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-[32px] p-8 shadow-sm">
                  <div className="text-center mb-8">
                    <p className="text-slate-500">Let&apos;s make sure your microphone is working before we enter the interview room.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[300px]">
                    {/* Camera Preview */}
                    <div className="col-span-1 md:col-span-2 bg-slate-50/50 border border-slate-200/50 rounded-[24px] overflow-hidden flex flex-col items-center justify-center relative min-h-[240px]">
                      {camStatus === "testing" && (
                        <div className="flex flex-col items-center animate-pulse text-sky-500">
                          <VideoCamera className="w-12 h-12 mb-4" weight="duotone" />
                          <p className="text-sm font-medium">Requesting camera access...</p>
                        </div>
                      )}
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-500 ${camStatus === "success" ? "opacity-100" : "opacity-0"}`}
                      />
                      {camStatus === "success" && (
                        <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-white text-xs font-medium border border-white/10 shadow-lg">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          Camera Active
                        </div>
                      )}
                      {camStatus === "error" && (
                        <div className="flex flex-col items-center text-rose-500 z-10">
                          <WarningCircle className="w-12 h-12 mb-4" weight="duotone" />
                          <p className="text-sm font-medium text-center px-4 max-w-sm">{errorMessage}</p>
                        </div>
                      )}
                    </div>

                    {/* Microphone Check */}
                    <div className="bg-slate-50/50 border border-slate-200/50 rounded-[24px] p-6 flex flex-col items-center justify-center text-center">
                      <div className="relative mb-4">
                        {micStatus === "success" && <div className="absolute inset-0 bg-emerald-400/20 rounded-full animate-ping" />}
                        <div className={`relative p-3 rounded-full border ${micStatus === "success" ? "bg-emerald-100 border-emerald-200 text-emerald-600" : "bg-slate-100 border-slate-200 text-slate-400"}`}>
                          <Microphone className="w-8 h-8" weight={micStatus === "success" ? "fill" : "duotone"} />
                        </div>
                      </div>
                      <h3 className="font-semibold text-slate-800 mb-1">Microphone</h3>
                      {micStatus === "success" ? (
                        <>
                          <div className="w-full max-w-[160px] h-12 my-2 overflow-hidden flex items-center justify-center">
                            <WaveformVisualizer 
                              analyser={analyser} 
                              color="#10b981" 
                              className="opacity-80"
                            />
                          </div>
                          <p className="text-xs text-slate-500">Speak to test levels</p>
                        </>
                      ) : (
                         <p className="text-xs text-slate-500 mt-2">Waiting for access...</p>
                      )}
                    </div>

                    {/* Network & Speaker */}
                    <div className="space-y-6">
                      {/* Speaker Check */}
                      <div className="bg-slate-50/50 border border-slate-200/50 rounded-[24px] p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="bg-sky-100 p-3 rounded-full border border-sky-200 text-sky-600">
                            <SpeakerHigh className="w-6 h-6" weight="duotone" />
                          </div>
                          <div className="text-left">
                            <h3 className="font-semibold text-slate-800 text-sm">Speaker Test</h3>
                            <p className="text-xs text-slate-500">Play a test sound</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full shadow-sm"
                          onClick={() => {
                            setSpeakerTestPlaying(true);
                            const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
                            audio.play().catch(() => setSpeakerTestPlaying(false));
                            audio.onended = () => setSpeakerTestPlaying(false);
                          }}
                          disabled={speakerTestPlaying}
                        >
                          {speakerTestPlaying ? "Playing..." : <><PlayCircle className="w-4 h-4 mr-1" /> Play</>}
                        </Button>
                      </div>

                      {/* Network Status */}
                      <div className="bg-slate-50/50 border border-slate-200/50 rounded-[24px] p-5 flex items-center gap-4">
                        <div className={`p-3 rounded-full border ${
                          networkStatus === "good" ? "bg-emerald-100 border-emerald-200 text-emerald-600" :
                          networkStatus === "poor" ? "bg-amber-100 border-amber-200 text-amber-600" :
                          networkStatus === "offline" ? "bg-rose-100 border-rose-200 text-rose-600" :
                          "bg-slate-100 border-slate-200 text-slate-400"
                        }`}>
                          {networkStatus === "good" ? <WifiHigh className="w-6 h-6" weight="bold" /> :
                           networkStatus === "poor" ? <WifiLow className="w-6 h-6" weight="bold" /> :
                           <WifiSlash className="w-6 h-6" weight="bold" />}
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-slate-800 text-sm">Network Connection</h3>
                          <p className="text-xs text-slate-500 capitalize">{networkStatus} status</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
            
            {/* Stepper Navigation */}
            <div className="mt-12 pt-6 border-t border-slate-200/60 flex items-center justify-between">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                disabled={currentStep === 1 || isStarting}
                className="rounded-2xl font-semibold px-8"
              >
                Back
              </Button>
              
              {currentStep < totalSteps ? (
                <Button 
                  onClick={() => setCurrentStep(prev => Math.min(totalSteps, prev + 1))}
                  size="lg" 
                  className="rounded-2xl font-bold bg-slate-900 text-white hover:bg-slate-800 px-8 shadow-md"
                >
                  Next Step
                </Button>
              ) : (
                <Button 
                  onClick={confirmAndStart} 
                  disabled={micStatus === "testing" || isStarting}
                  size="lg" 
                  className="relative rounded-[24px] h-12 px-8 font-bold tracking-wide shadow-[0_8px_24px_rgba(14,165,233,0.25)] group overflow-hidden bg-slate-900 text-white hover:bg-slate-800 border border-slate-800 transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-emerald-400 to-sky-500 opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                  <span className="relative z-10 flex items-center justify-center">
                    {isStarting ? (
                      <><CircleNotch className="w-5 h-5 mr-2 animate-spin" /> Starting...</>
                    ) : (
                      <>
                        {micStatus === "success" ? "Start Session" : "Start without Mic"}
                        <motion.div
                          className="ml-2 inline-flex"
                          whileHover={{ x: 5 }}
                          transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        >
                          <CaretRight className="w-5 h-5" weight="bold" />
                        </motion.div>
                      </>
                    )}
                  </span>
                </Button>
              )}
            </div>

              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
