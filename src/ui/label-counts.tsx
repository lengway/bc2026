import type { Evaluation } from "@/contracts";
import { cn } from "@/ui/lib/utils";
import { MOVE_LABEL_META, MOVE_LABEL_ORDER } from "@/ui/move-labels";

type LabelCountsProps = {
  counts: Evaluation["labelCounts"];
  /** `full` shows the label name next to each glyph. */
  variant?: "compact" | "full";
  className?: string;
};

/** How many moves got each label, best to worst. */
export function LabelCounts({ counts, variant = "compact", className }: LabelCountsProps) {
  return (
    <ul
      aria-label="Moves by label"
      className={cn("m-0 flex list-none flex-wrap gap-1.5 p-0", className)}
    >
      {MOVE_LABEL_ORDER.map((label) => {
        const meta = MOVE_LABEL_META[label];
        const count = counts[label] ?? 0;
        return (
          <li
            key={label}
            data-label={label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
              count === 0
                ? "border-border text-muted-foreground"
                : cn("border-transparent", meta.badgeClassName),
            )}
          >
            <span aria-hidden="true" className="font-mono">
              {meta.glyph}
            </span>
            <span className={cn(variant === "compact" && "sr-only")}>{meta.name}</span>
            <span className="font-mono tabular-nums">{count}</span>
          </li>
        );
      })}
    </ul>
  );
}
