"use client";

import type { Evaluation, MoveReview } from "@/contracts";
import { cn } from "@/ui/lib/utils";
import { MOVE_LABEL_META } from "@/ui/move-labels";

type TrustCurveChartProps = {
  /** Trust after each move, in order. */
  curve: Evaluation["trustCurve"];
  /** Reviewed moves; matched to curve points by `seq` to color them. */
  moves: ReadonlyArray<Pick<MoveReview, "seq" | "label" | "assessmentStatus">>;
  selectedSeq?: number | null;
  /** Called with the move's `seq`. Omit for a read-only chart. */
  onSelectMove?: (seq: number) => void;
  /** Whose trust this is, for the accessible name. */
  personaName?: string;
  /** Height utility for the plot area. */
  heightClassName?: string;
  className?: string;
};

const GRID_LINES = [0, 25, 50, 75, 100];
const AXIS_TICKS = [100, 50, 0];

function clampTrust(trust: number): number {
  return Math.min(100, Math.max(0, trust));
}

/**
 * Trust across the conversation, like the evaluation graph of a chess game.
 * Points are real buttons, so the chart works with keyboard and screen readers.
 */
export function TrustCurveChart({
  curve,
  moves,
  selectedSeq = null,
  onSelectMove,
  personaName,
  heightClassName = "h-52",
  className,
}: TrustCurveChartProps) {
  const title = personaName ? `Trust · ${personaName}` : "Trust";

  if (curve.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground",
          heightClassName,
          className,
        )}
      >
        No moves to chart yet.
      </div>
    );
  }

  const moveBySeq = new Map(moves.map((move) => [move.seq, move]));
  const lastIndex = curve.length - 1;
  const points = curve.map((point, index) => {
    const move = moveBySeq.get(point.seq);
    return {
      seq: point.seq,
      moveNumber: index + 1,
      trust: clampTrust(point.trust),
      x: lastIndex === 0 ? 50 : (index / lastIndex) * 100,
      y: 100 - clampTrust(point.trust),
      meta: move?.assessmentStatus === "assessed" ? MOVE_LABEL_META[move.label] : null,
      unassessed: move?.assessmentStatus === "insufficient_evidence",
    };
  });
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const tickEvery = points.length > 16 ? 2 : 1;
  const first = points[0];
  const last = points[lastIndex];

  return (
    <figure className={cn("m-0 flex flex-col gap-2", className)}>
      <figcaption className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>{title}</span>
        <span className="sr-only">
          {`Starts at ${first.trust}, ends at ${last.trust} after ${points.length} moves.`}
        </span>
        <span aria-hidden="true" className="font-mono">
          0–100
        </span>
      </figcaption>

      <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2">
        <div
          aria-hidden="true"
          className={cn(
            "relative font-mono text-[10px] text-muted-foreground tabular-nums",
            heightClassName,
          )}
        >
          {AXIS_TICKS.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${100 - tick}%` }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className={cn("relative mx-3", heightClassName)}>
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
          >
            {GRID_LINES.map((line) => (
              <line
                key={line}
                x1="0"
                x2="100"
                y1={100 - line}
                y2={100 - line}
                vectorEffect="non-scaling-stroke"
                strokeDasharray={line === 50 ? "2 4" : undefined}
                className="stroke-border"
                strokeWidth="1"
              />
            ))}
            <polyline
              points={polyline}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="stroke-foreground"
              strokeWidth="1.5"
            />
          </svg>

          {points.map((point) => {
            const selected = point.seq === selectedSeq;
            const name = point.meta ? point.meta.name : point.unassessed ? "Unassessed" : "Unreviewed";
            const description = `Move ${point.moveNumber}, ${name}, trust ${point.trust}`;
            return (
              <button
                key={point.seq}
                type="button"
                disabled={!onSelectMove}
                aria-label={description}
                aria-pressed={onSelectMove ? selected : undefined}
                title={description}
                onClick={() => onSelectMove?.(point.seq)}
                className={cn(
                  "group absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "z-10",
                )}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                <span
                  className={cn(
                    "size-2.5 rounded-full ring-2 ring-background transition-transform duration-150 ease-out",
                    point.meta ? point.meta.dotClassName : "bg-muted-foreground",
                    onSelectMove && "group-hover:scale-125",
                    selected && "scale-125 outline-2 outline-offset-2 outline-ink",
                  )}
                />
                {point.meta?.notable ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute left-1/2 -translate-x-1/2 font-mono text-[11px] leading-none font-medium",
                      point.meta.tone === "positive" ? "-top-2" : "-bottom-2",
                      point.meta.textClassName,
                    )}
                  >
                    {point.meta.glyph}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div aria-hidden="true" />
        <div
          aria-hidden="true"
          className="relative mx-3 mt-2 h-4 font-mono text-[10px] text-muted-foreground tabular-nums"
        >
          {points.map((point, index) =>
            index % tickEvery === 0 ? (
              <span
                key={point.seq}
                className={cn(
                  "absolute -translate-x-1/2",
                  point.seq === selectedSeq && "font-medium text-foreground",
                )}
                style={{ left: `${point.x}%` }}
              >
                {point.moveNumber}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </figure>
  );
}
