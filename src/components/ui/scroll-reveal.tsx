"use client";

import React, { useRef } from "react";
import { motion, useInView, type Variants, type UseInViewOptions } from "framer-motion";

type Direction = "up" | "down" | "left" | "right";

interface ScrollRevealProps {
  children: React.ReactNode;
  /** Entry direction — which direction the element slides in from */
  direction?: Direction;
  /** Delay in seconds before the animation starts */
  delay?: number;
  /** Duration of the animation in seconds */
  duration?: number;
  /** If true, animates only the first time the element enters the viewport */
  once?: boolean;
  /** How much of the element must be visible before triggering (0-1) */
  threshold?: number;
  /** Additional className for the wrapper */
  className?: string;
  /** Viewport margin (e.g. "-100px" to trigger earlier) */
  viewportMargin?: UseInViewOptions["margin"];
}

const directionOffsets: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 40 },
  down: { x: 0, y: -40 },
  left: { x: 40, y: 0 },
  right: { x: -40, y: 0 },
};

export function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.7,
  once = true,
  threshold = 0.15,
  className,
  viewportMargin = "-60px",
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {
    once,
    amount: threshold,
    margin: viewportMargin,
  });

  const offset = directionOffsets[direction];

  const variants: Variants = {
    hidden: {
      opacity: 0,
      x: offset.x,
      y: offset.y,
      filter: "blur(6px)",
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      filter: "blur(0px)",
      transition: {
        type: "spring",
        damping: 30,
        stiffness: 200,
        delay,
        duration,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Container that staggers ScrollReveal animations for its children.
 * Wrap multiple <ScrollReveal> components to auto-stagger their delays.
 */
interface ScrollRevealGroupProps {
  children: React.ReactNode;
  /** Base delay for the first child */
  baseDelay?: number;
  /** Delay increment between each child */
  staggerDelay?: number;
  className?: string;
}

export function ScrollRevealGroup({
  children,
  baseDelay = 0,
  staggerDelay = 0.08,
  className,
}: ScrollRevealGroupProps) {
  const childArray = React.Children.toArray(children);

  return (
    <div className={className}>
      {childArray.map((child, index) => {
        if (React.isValidElement(child) && child.type === ScrollReveal) {
          return React.cloneElement(child as React.ReactElement<ScrollRevealProps>, {
            delay: baseDelay + index * staggerDelay,
          });
        }
        return (
          <ScrollReveal key={index} delay={baseDelay + index * staggerDelay}>
            {child}
          </ScrollReveal>
        );
      })}
    </div>
  );
}
