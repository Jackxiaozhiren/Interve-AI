"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { cn } from "@/lib/utils";

interface TextRevealProps {
  text: string;
  className?: string;
  delay?: number;
}

export function TextReveal({ text, className, delay = 0 }: TextRevealProps) {
  // Split text by newlines, preserving the newlines in the array
  const segments = text.split(/(\n)/);
  
  const tokens: string[] = [];
  segments.forEach(segment => {
    if (segment === "\n") {
      tokens.push("\n");
    } else {
      // Split by space to get words
      const words = segment.split(" ");
      tokens.push(...words);
    }
  });

  const container: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.02, delayChildren: delay },
    },
  };

  const child: Variants = {
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        type: "spring",
        damping: 15,
        stiffness: 100,
      },
    },
    hidden: {
      opacity: 0,
      y: 10,
      filter: "blur(4px)",
    },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      className={cn("flex flex-wrap gap-x-[0.25em] gap-y-1", className)}
    >
      {tokens.map((token, index) => {
        if (token === "\n") {
          // Force a line break
          return <div key={index} className="w-full basis-full h-1" />;
        }
        if (token === "") {
          // Handle consecutive spaces resulting in empty strings from split(" ")
          return (
            <motion.span variants={child} key={index} className="inline-block">
              {"\u00A0"}
            </motion.span>
          );
        }
        return (
          <motion.span variants={child} key={index} className="inline-block">
            {token}
          </motion.span>
        );
      })}
    </motion.div>
  );
}
