import { Clock } from "lucide-react";
import { formatClock, formatDurationWords } from "@/ui/lib/format";
import { cn } from "@/ui/lib/utils";

type CaseTimerState = "running" | "warning" | "expired";

type CaseTimerProps = {
  /** Seconds left. The container owns the countdown. */
  remainingSec: number;
  /** At or below this many seconds the timer turns to its warning state. */
  warnAtSec?: number;
  className?: string;
};

export function getCaseTimerState(remainingSec: number, warnAtSec: number): CaseTimerState {
  if (remainingSec <= 0) return "expired";
  if (remainingSec <= warnAtSec) return "warning";
  return "running";
}

/** Time left in the case. Monospace, tabular, never jumps as digits change. */
export function CaseTimer({ remainingSec, warnAtSec = 60, className }: CaseTimerProps) {
  const state = getCaseTimerState(remainingSec, warnAtSec);
  const spoken =
    state === "expired"
      ? "Time is up"
      : `Time remaining: ${formatDurationWords(remainingSec)}`;

  return (
    <span
      role="timer"
      aria-label={spoken}
      data-state={state}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border bg-surface px-3 font-mono text-sm tabular-nums",
        state === "warning" && "border-label-inaccuracy/40 bg-label-inaccuracy-soft text-label-inaccuracy",
        state === "expired" && "border-label-blunder/40 bg-label-blunder-soft text-label-blunder",
        className,
      )}
    >
      <Clock aria-hidden="true" className="size-4" strokeWidth={1.5} />
      <span aria-hidden="true">{formatClock(remainingSec)}</span>
      {state === "expired" ? (
        <span aria-hidden="true" className="font-sans text-xs font-medium">
          Time is up
        </span>
      ) : null}
    </span>
  );
}
