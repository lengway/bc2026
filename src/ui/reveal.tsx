"use client";

import { useReducedMotion } from "@/ui/lib/use-reduced-motion";
import { BlurFade } from "@/ui/primitives/blur-fade";

type RevealProps = {
  children: React.ReactNode;
  /** Seconds. */
  delay?: number;
  className?: string;
};

/**
 * Fades a section in the first time it scrolls into view. For content below
 * the fold only: it starts hidden, so never wrap the hero in it.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <BlurFade
      inView
      delay={prefersReducedMotion ? 0 : delay}
      duration={prefersReducedMotion ? 0 : 0.25}
      offset={prefersReducedMotion ? 0 : 6}
      blur={prefersReducedMotion ? "0px" : "4px"}
      direction="up"
      className={className}
    >
      {children}
    </BlurFade>
  );
}
