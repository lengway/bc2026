import type { SkillPath } from "@/contracts";
import { cn } from "@/ui/lib/utils";

type PracticeDay = {
  /** Short label for the day, e.g. "Mon" or "Nov 14". */
  label: string;
  practiced: boolean;
};

type PracticeRecordProps = {
  streak: SkillPath["streak"];
  /** Recent days, oldest first. Optional: the contract only guarantees the counts. */
  days?: ReadonlyArray<PracticeDay>;
  className?: string;
  variant?: "default" | "compact";
};

/** The practice streak, stated like a record and not like a game mechanic. */
export function PracticeRecord({
  streak,
  days,
  className,
  variant = "default",
}: PracticeRecordProps) {
  const compact = variant === "compact";
  const strip = days?.length ? (
    <ol
      aria-label="Recent days"
      className={cn("m-0 flex list-none gap-1 p-0", compact && className)}
    >
      {days.map((day, index) => (
        <li key={`${day.label}-${index}`} className="flex-1">
          <span
            role="img"
            aria-label={`${day.label}: ${day.practiced ? "practiced" : "no practice"}`}
            title={day.label}
            className={cn(
              "block rounded-sm border",
              compact ? "h-2.5" : "h-6",
              day.practiced ? "border-ink bg-ink" : "border-border bg-surface",
            )}
          />
        </li>
      ))}
    </ol>
  ) : null;
  if (compact) return strip;

  const dayWord = streak.current === 1 ? "day" : "days";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="m-0 text-xs text-muted-foreground">Practice record</p>
          <p className="m-0 text-2xl leading-none font-medium tracking-tight">
            <span className="font-mono tabular-nums">{streak.current}</span>
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              {dayWord} in a row
            </span>
          </p>
        </div>
        <p className="m-0 text-xs text-muted-foreground">
          Best{" "}
          <span className="font-mono text-foreground tabular-nums">
            {streak.best}
          </span>
        </p>
      </div>

      {strip}
    </div>
  );
}
