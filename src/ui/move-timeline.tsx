"use client";

import type { MoveReview } from "@/contracts";
import { cn } from "@/ui/lib/utils";
import { MoveLabelBadge } from "@/ui/move-label-badge";

type MoveTimelineProps = {
  moves: ReadonlyArray<Pick<MoveReview, "seq" | "label" | "userText" | "trustAfter" | "assessmentStatus">>;
  selectedSeq?: number | null;
  onSelectMove?: (seq: number) => void;
  className?: string;
};

/** Every move of the case in order: number, label glyph, first line. */
export function MoveTimeline({
  moves,
  selectedSeq = null,
  onSelectMove,
  className,
}: MoveTimelineProps) {
  if (moves.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No moves were made in this case.
      </p>
    );
  }

  return (
    <ol
      aria-label="Moves"
      className={cn("m-0 list-none divide-y rounded-lg border p-0", className)}
    >
      {moves.map((move, index) => {
        const selected = move.seq === selectedSeq;
        return (
          <li key={move.seq} className="first:rounded-t-lg last:rounded-b-lg">
            <button
              type="button"
              disabled={!onSelectMove}
              aria-current={selected ? "true" : undefined}
              onClick={() => onSelectMove?.(move.seq)}
              className={cn(
                "grid min-h-11 w-full grid-cols-[1.5rem_2.25rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-left text-sm outline-none",
                "transition-colors duration-150 ease-out",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                onSelectMove && "hover:bg-surface",
                selected && "bg-ink-soft hover:bg-ink-soft",
              )}
            >
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <MoveLabelBadge
                label={move.assessmentStatus === "assessed" ? move.label : null}
                variant="glyph"
                size="sm"
                className="justify-self-start"
              />
              <span className="truncate">{move.userText}</span>
              <span
                className="font-mono text-xs text-muted-foreground tabular-nums"
                title="Trust after this move"
              >
                {move.trustAfter}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
