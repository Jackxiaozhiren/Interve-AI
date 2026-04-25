import { Variants, Transition } from "framer-motion";

/* ═══════════════════════════════════════
   Interve AI — Motion Configuration
   
   Design System Constraint: 
   ALL transitions use cubic-bezier(0.2, 0, 0, 1) — matches CSS --ease-primary.
   NO spring physics — ensures CSS ↔ JS animation parity.
   ═══════════════════════════════════════ */

/** Standard easing — 250ms, used for most UI transitions */
export const easePrimary: Transition = {
  type: "tween",
  duration: 0.25,
  ease: [0.2, 0, 0, 1],
};

/** @deprecated Use easePrimary instead. Kept for backward compat. */
export const springConfig: Transition = easePrimary;

/** Slow easing — 350ms, used for waterfall/page entrance */
export const easeSlowConfig: Transition = {
  type: "tween",
  duration: 0.35,
  ease: [0.2, 0, 0, 1],
};

/** @deprecated Use easeSlowConfig instead. */
export const slowSpringConfig: Transition = easeSlowConfig;

/** Fast easing — 200ms, used for micro-interactions */
export const easeFastConfig: Transition = {
  type: "tween",
  duration: 0.2,
  ease: [0.2, 0, 0, 1],
};

/** @deprecated Use easeFastConfig instead. */
export const bouncySpringConfig: Transition = easeFastConfig;

// Common page/section transition
export const fadeUpVariant: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: {
      ...easePrimary,
      staggerChildren: 0.1,
    }
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Bento grid stagger: cards appear with blur-to-focus + scale-up
export const bentoCardVariant: Variants = {
  hidden: { 
    opacity: 0, 
    y: 40, 
    scale: 0.95,
    filter: "blur(8px)"
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    filter: "blur(0px)",
    transition: {
      ...easePrimary,
    }
  },
};

export const bentoContainerVariant: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

// Waterfall entrance for Setup page sections
export const waterfallVariant: Variants = {
  hidden: { 
    opacity: 0, 
    y: 60, 
    scale: 0.97,
    filter: "blur(6px)"
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    filter: "blur(0px)",
    transition: {
      ...easeSlowConfig,
    }
  },
};

export const waterfallContainerVariant: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.18,
      delayChildren: 0.2,
    },
  },
};

// ScrollReveal for session list items
export const scrollRevealVariant: Variants = {
  hidden: { 
    opacity: 0, 
    y: 30,
    filter: "blur(4px)"
  },
  visible: { 
    opacity: 1, 
    y: 0,
    filter: "blur(0px)",
    transition: {
      ...easePrimary,
    }
  },
};

export const glassHoverVariant = {
  rest: { 
    scale: 1,
    boxShadow: "0 12px 30px -10px rgba(0, 0, 0, 0.02)",
    y: 0 
  },
  hover: { 
    scale: 1.02,
    boxShadow: "0 24px 50px -12px rgba(0, 0, 0, 0.06)",
    y: -4,
    transition: easePrimary
  },
  tap: { 
    scale: 0.97,
    boxShadow: "0 8px 20px -8px rgba(0, 0, 0, 0.04)",
    y: 0,
    transition: easeFastConfig
  }
};
