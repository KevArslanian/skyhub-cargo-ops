"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useRef } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";

export type SceneVariant = "heroOut" | "rise" | "depth" | "left" | "right";

const EASE = [0.22, 1, 0.36, 1] as const;

const MOTION_VARIANTS: Record<SceneVariant, Variants> = {
  heroOut: {
    hidden: { opacity: 0, scale: 1.06 },
    visible: { opacity: 1, scale: 1, transition: { duration: 1, ease: EASE } },
  },
  rise: {
    hidden: { opacity: 0, y: 96, scale: 0.96 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.85, ease: EASE } },
  },
  depth: {
    hidden: { opacity: 0, y: 48, scale: 0.94 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.9, ease: EASE } },
  },
  left: {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.82, ease: EASE } },
  },
  right: {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.82, ease: EASE } },
  },
};

const REDUCED_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

type ScrollSceneProps = ComponentPropsWithoutRef<typeof motion.section> & {
  variant?: SceneVariant;
  revealOnce?: boolean;
  children: ReactNode;
};

export function ScrollScene({ variant = "rise", revealOnce = false, children, style, ...rest }: ScrollSceneProps) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const isHero = variant === "heroOut";

  const variants = reduceMotion ? REDUCED_VARIANTS : MOTION_VARIANTS[variant];

  // Hero animates on mount. Other sections stay readable when jumping via nav
  // (parent must not sit at opacity:0 waiting for whileInView). Inner .premium-reveal
  // still handles staged copy fades.
  const inViewProps = isHero
    ? { initial: "hidden" as const, animate: "visible" as const }
    : {
        initial: "visible" as const,
        animate: "visible" as const,
        whileInView: "visible" as const,
        viewport: { once: revealOnce, amount: 0.05, margin: "0px 0px -5% 0px" },
      };

  return (
    <motion.section
      ref={ref}
      variants={variants}
      style={{ position: "relative", willChange: "transform, opacity", ...style }}
      {...inViewProps}
      {...rest}
    >
      {children}
    </motion.section>
  );
}
