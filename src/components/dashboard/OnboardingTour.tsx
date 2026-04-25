"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { Sparkle, ChatCircleText, ChartLineUp, X } from "@phosphor-icons/react";

const steps = [
  {
    title: "Welcome to Interve AI",
    description: "Your personalized interview mastery platform. Let's take a quick look around your new command center.",
    icon: <Sparkle className="w-8 h-8 text-sky-500" weight="duotone" />
  },
  {
    title: "Mock Interviews",
    description: "Start realistic voice or text-based practice sessions. Our AI panel will adapt to your resume and the specific job description.",
    icon: <ChatCircleText className="w-8 h-8 text-emerald-500" weight="duotone" />
  },
  {
    title: "Analytics & Trends",
    description: "After your sessions, track your recurring flaws, key strengths, and get an actionable growth plan tailored just for you.",
    icon: <ChartLineUp className="w-8 h-8 text-indigo-500" weight="duotone" />
  }
];

export function OnboardingTour() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if the user has seen the onboarding before
    const hasSeenOnboarding = localStorage.getItem("interve_has_seen_onboarding");
    if (!hasSeenOnboarding) {
      // Small delay to let the dashboard render first
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem("interve_has_seen_onboarding", "true");
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md"
            >
              <Card className="bg-white/90 backdrop-blur-2xl border-white/50 shadow-2xl overflow-hidden relative">
                <button 
                  onClick={handleClose}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-6">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.5, rotate: 10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {steps[currentStep].icon}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStep}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3 min-h-[100px]"
                    >
                      <h3 className="text-xl font-serif font-semibold text-slate-900">
                        {steps[currentStep].title}
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed max-w-[300px] mx-auto">
                        {steps[currentStep].description}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  <div className="flex items-center gap-2 mt-8 mb-6">
                    {steps.map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          i === currentStep ? "bg-sky-500 w-6" : "bg-slate-200"
                        }`} 
                      />
                    ))}
                  </div>

                  <MagneticButton 
                    onClick={handleNext}
                    className="w-full h-11 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-semibold shadow-md"
                  >
                    {currentStep === steps.length - 1 ? "Get Started" : "Next"}
                  </MagneticButton>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
