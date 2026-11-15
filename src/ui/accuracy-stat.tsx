"use client";

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
  if (accuracy === null)
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xl font-medium">Not enough evidence</span>
      </div>
    );
  const value = Math.round(Math.min(100, Math.max(0, accuracy)));

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {animate && <span className="sr-only">{value}%</span>}
      <span
        aria-hidden={animate || undefined}
        className={cn(
          "font-mono leading-none font-medium tracking-tight tabular-nums",
          SIZE_CLASS[size],
        )}
      >
        {animate ? (
          <>
            <span className="motion-reduce:hidden">
              <NumberTicker value={value} />
            </span>
            <span className="hidden motion-reduce:inline">{value}</span>
          </>
        ) : (
          value
        )}
        %
      </span>
    </div>
  );
}
