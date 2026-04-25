"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { WarningCircle, ArrowClockwise } from "@phosphor-icons/react";
import { motion } from "framer-motion";

import { easePrimary } from "@/lib/motion";

const springConfig = easePrimary;

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global application error:", error);
  }, [error]);

  return (
    <div className="flex flex-col h-screen items-center justify-center bg-[#FBFBFA] text-center px-4 font-sans relative overflow-hidden">
      {/* Ambient liquid background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[15%] right-[15%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-rose-100/30 blur-[120px] rounded-full mix-blend-multiply" />
        <div className="absolute bottom-[15%] left-[10%] w-[35vw] h-[35vw] max-w-[400px] max-h-[400px] bg-sky-100/20 blur-[100px] rounded-full mix-blend-multiply" />
      </div>

      {/* Error icon with shake + spring */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ ...springConfig, delay: 0.1 }}
        className="w-24 h-24 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mb-6 shadow-sm text-rose-500 relative overflow-hidden"
      >
        <WarningCircle className="w-12 h-12 relative z-10" weight="duotone" />
        {/* Subtle pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-full bg-rose-100"
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ ...springConfig, delay: 0.25 }}
      >
        <h1 className="text-3xl font-serif text-slate-900 mb-2 tracking-tight">Something went wrong</h1>
        <p className="text-slate-500 mb-8 max-w-md mx-auto text-base font-medium leading-relaxed">
          An unexpected error has occurred. Our diagnostic systems have logged the issue.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springConfig, delay: 0.4 }}
        className="flex items-center gap-4"
      >
        <Button
          onClick={reset}
          className="rounded-full shadow-[0_8px_24px_rgba(15,23,42,0.15)] bg-slate-900 hover:bg-slate-800 font-semibold border border-slate-800"
        >
          <ArrowClockwise className="w-4 h-4 mr-2" weight="bold" />
          Try Again
        </Button>
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/dashboard")}
          className="rounded-full font-semibold"
        >
          Go to Dashboard
        </Button>
      </motion.div>
    </div>
  );
}
