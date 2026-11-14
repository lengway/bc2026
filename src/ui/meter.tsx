import { cn } from "@/ui/lib/utils";

type MeterProps = {
  label: string;
  /** 0–100 */
  value: number | null;
  /** Shown at the right, defaults to the value. */
  valueLabel?: string;
  /** Short explanation under the bar. */
  hint?: string;
  tone?: "ink" | "neutral" | "warning";
  className?: string;
};

const TONE_CLASS = {
  ink: "bg-ink",
  neutral: "bg-muted-foreground",
  warning: "bg-label-mistake",
} as const;

/** A labeled 0–100 bar: skill scores, AI dependency. */
export function Meter({ label, value, valueLabel, hint, tone = "ink", className }: MeterProps) {
  const clamped = value === null ? null : Math.round(Math.min(100, Math.max(0, value)));
  const text = clamped === null ? "Unavailable" : valueLabel ?? String(clamped);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{text}</span>
      </div>
      {clamped !== null ? (
        <div
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clamped}
          aria-valuetext={text}
          className="h-1.5 overflow-hidden rounded-sm bg-muted"
        >
          <div className={cn("h-full rounded-sm", TONE_CLASS[tone])} style={{ width: `${clamped}%` }} />
        </div>
      ) : null}
      {hint ? <p className="m-0 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
