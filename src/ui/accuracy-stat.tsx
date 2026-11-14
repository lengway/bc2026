"use client";

import { useReducedMotion } from "@/ui/lib/use-reduced-motion";
import { cn } from "@/ui/lib/utils";
import { NumberTicker } from "@/ui/primitives/number-ticker";

type AccuracyStatProps = {
  /** 0–100 */
  accuracy: number | null;
  /** Count up on reveal. Skipped when the user prefers reduced motion. */
  animate?: boolean;
  size?: "md" | "lg" | "xl";
  label?: string;
  className?: string;
};

const SIZE_CLASS = {
  md: "text-display-sm",
  lg: "text-display",
  xl: "text-display-lg",
} as const;

/** The headline number of a review. */
export function AccuracyStat({
  accuracy,
  animate = false,
  size = "lg",
  label = "Accuracy",
  className,
}: AccuracyStatProps) {
  const prefersReducedMotion = useReducedMotion();
  const value = accuracy === null ? null : Math.round(Math.min(100, Math.max(0, accuracy)));
  const shouldAnimate = animate && !prefersReducedMotion;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {value === null ? (
        <span className="text-sm text-muted-foreground">Unavailable</span>
      ) : (
        <>
          <span className="sr-only">{value}%</span>
          <span
            aria-hidden="true"
            className={cn(
              "font-mono leading-none font-medium tracking-tight tabular-nums",
              SIZE_CLASS[size],
            )}
          >
            {shouldAnimate ? <NumberTicker value={value} /> : value}%
          </span>
        </>
      )}
    </div>
  );
}
