"use client";

import Link from "next/link";
import { MagnifyingGlass, House, ArrowLeft } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { motion } from "framer-motion";

import { easePrimary } from "@/lib/motion";

const easeConfig = easePrimary;

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#FBFBFA] px-4 text-center font-sans relative overflow-hidden">
      {/* Ambient liquid background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[20%] left-[10%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-sky-200/30 blur-[120px] rounded-full mix-blend-multiply" />
        <div className="absolute bottom-[10%] right-[10%] w-[35vw] h-[35vw] max-w-[400px] max-h-[400px] bg-emerald-100/25 blur-[100px] rounded-full mix-blend-multiply" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...easeConfig, staggerChildren: 0.1 }}
        className="max-w-md space-y-6"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ ...easeConfig, delay: 0.1 }}
          className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-sky-50 border border-sky-100 shadow-sm relative overflow-hidden"
        >
          <MagnifyingGlass className="h-10 w-10 text-sky-500 relative z-10" weight="duotone" />
          {/* Breathing pulse */}
          <motion.div
            className="absolute inset-0 rounded-full bg-sky-100"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ ...easeConfig, delay: 0.25 }}
          className="space-y-2"
        >
          <h1 className="text-5xl font-serif text-slate-900 tracking-tight">404</h1>
          <h2 className="text-xl font-medium text-slate-700">Page not found</h2>
          <p className="text-slate-500 leading-relaxed max-w-sm mx-auto font-medium">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or doesn&apos;t exist.
          </p>
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...easeConfig, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4"
        >
          <Link
            href="/dashboard"
            className={buttonVariants({
              variant: "default",
              className:
                "w-full sm:w-auto bg-slate-900 hover:bg-slate-800 gap-2 rounded-full shadow-[0_8px_24px_rgba(15,23,42,0.15)] border border-slate-800",
            })}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <Link
            href="/"
            className={buttonVariants({
              variant: "outline",
              className: "w-full sm:w-auto gap-2 rounded-full",
            })}
          >
            <House className="w-4 h-4" /> Home
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
