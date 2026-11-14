import type { MoveReview } from "@/contracts";
import { firstName } from "@/ui/lib/format";
import { cn } from "@/ui/lib/utils";
import { MoveLabelBadge } from "@/ui/move-label-badge";
import { PersonaAvatar } from "@/ui/persona-card";

type MoveDetailProps = {
  move: MoveReview;
  /** 1-based position among the user's moves. */
  moveNumber: number;
  totalMoves: number;
  /** Who the user was talking to, e.g. "Dana Whitfield". */
  personaName: string;
  /** Trust before this move. Omit to hide the delta. */
  trustBefore?: number | null;
  /** Pre-formatted time into the case, e.g. "05:41". */
  timeLabel?: string;
  className?: string;
};

function SectionTitle({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <h4
      className={cn(
        "m-0 text-xs font-medium",
        accent ? "text-ink" : "text-muted-foreground",
      )}
    >
      {children}
    </h4>
  );
}

/** The full review of one move: what was said, why it got its label, what would have been better. */
export function MoveDetail({
  move,
  moveNumber,
  totalMoves,
  personaName,
  trustBefore = null,
  timeLabel,
  className,
}: MoveDetailProps) {
  const delta = trustBefore === null ? null : move.trustAfter - trustBefore;

  return (
    <article
      aria-label={`Move ${moveNumber} of ${totalMoves}`}
      className={cn("rounded-xl border bg-card text-card-foreground", className)}
    >
      <header className="flex items-center justify-between gap-4 border-b px-5 py-3.5">
        <div className="flex items-center gap-3">
          <MoveLabelBadge label={move.label} />
          <h3 className="m-0 text-sm font-medium">
            Move {moveNumber} of {totalMoves}
          </h3>
        </div>
        {timeLabel ? (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {timeLabel}
          </span>
        ) : null}
      </header>

      <div className="flex flex-col gap-5 p-5">
        <section className="flex flex-col gap-2">
          <SectionTitle>Your move</SectionTitle>
          <p className="m-0 rounded-lg border bg-surface px-3.5 py-3 text-[15px] leading-normal">
            {move.userText}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle>Why</SectionTitle>
          <p className="m-0 text-sm leading-relaxed">{move.why}</p>
        </section>

        {move.betterMove ? (
          <section className="flex flex-col gap-2">
            <SectionTitle accent>Better move</SectionTitle>
            <p className="m-0 rounded-lg border border-ink-border bg-ink-soft px-3.5 py-3 text-[15px] leading-normal">
              {move.betterMove}
            </p>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <SectionTitle>What {firstName(personaName)} was thinking</SectionTitle>
          <div className="flex items-start gap-3">
            <PersonaAvatar name={personaName} />
            <p className="m-0 pt-1 text-sm leading-relaxed text-muted-foreground italic">
              {move.innerThought}
            </p>
          </div>
        </section>
      </div>

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-b-xl border-t bg-surface px-5 py-3 text-[13px] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          Trust
          <span className="font-mono text-foreground tabular-nums">
            {trustBefore === null
              ? move.trustAfter
              : `${trustBefore} → ${move.trustAfter}`}
          </span>
          {delta !== null && delta !== 0 ? (
            <span
              className={cn(
                "font-mono tabular-nums",
                delta > 0 ? "text-label-best" : "text-label-blunder",
              )}
            >
              {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
            </span>
          ) : null}
        </span>
      </footer>
    </article>
  );
}
