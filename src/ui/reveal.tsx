"use client";

import { useSyncExternalStore } from "react";
import { BlurFade } from "@/ui/primitives/blur-fade";

type RevealProps = {
  children: React.ReactNode;
  /** Seconds. */
  delay?: number;
  className?: string;
};
const query = "(prefers-reduced-motion: reduce)";
function subscribe(listener: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;

/**
 * Fades a section in the first time it scrolls into view. For content below
 * the fold only: it starts hidden, so never wrap the hero in it.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  // Hydration uses the same snapshot as SSR before reading the browser preference.
  const prefersReducedMotion = useSyncExternalStore(
    subscribe,
    snapshot,
    serverSnapshot,
  );

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
