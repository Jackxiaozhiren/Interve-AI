"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import * as React from "react";
import { cn } from "@/lib/utils";

interface MotionWrapperProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function MotionWrapper({
  children,
  className,
  delay = 0,
  ...props
}: MotionWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{
        type: "spring",
        stiffness: 80,
        damping: 15,
        mass: 0.8,
        delay: delay,
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
